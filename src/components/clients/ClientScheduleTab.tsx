"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { differenceInDays, addDays, format } from "date-fns";

const GOLD = "#C9A84C";
const CELL_WIDTH = 28;
const ROW_HEIGHT = 36;
const PHASE_ROW_HEIGHT = 28;
const LABEL_WIDTH = 240;
const HEADER_H = 22;
const RESIZE_HANDLE_W = 8;

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: GOLD,
  IN_PROGRESS: "#3b82f6",
  DONE: "#22c55e",
  BLOCKED: "#f97316",
};
const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"];

const INPUT: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #30373f",
  color: "#e6edf3",
  WebkitTextFillColor: "#e6edf3",
  colorScheme: "dark",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 13,
  width: "100%",
};

type LinkType = "FS" | "SS" | "FF" | "SF";
type TaskLink = { id: string; type: LinkType; lag: number };

type ClientTask = {
  id: string;
  phase: string;
  name: string;
  durationDays: number;
  startDate: string | null;
  endDate: string | null;
  predecessorIds: string[];
  predecessors?: TaskLink[] | null;
  parentId: string | null;
  trade: string | null;
  assignee: string | null;
  isMilestone: boolean;
  status: string;
  percentComplete: number;
  notes: string | null;
  priority: string | null;
  actualFinish: string | null;
  sortOrder: number;
};

type DragState = {
  taskId: string;
  type: "move" | "resize";
  originalStart: Date;
  originalEnd: Date;
  mouseStartX: number;
  currentDeltaDays: number;
};

function todayStr() { return new Date().toISOString().slice(0, 10); }
function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  // Normalize: strip time portion if full ISO string
  const datePart = s.length > 10 ? s.slice(0, 10) : s;
  const d = new Date(datePart + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}
function normDate(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.length > 10 ? s.slice(0, 10) : s;
}

// ── Schedule Templates ─────────────────────────────────────────────────────────

type TplTask = {
  localId?: string; phase: string; name: string; durationDays: number; offsetDays: number;
  trade?: string; isMilestone?: boolean; parentRef?: string; predecessorRefs?: string[];
};
type ScheduleTemplate = { id: string; label: string; emoji: string; description: string; tasks: TplTask[] };

const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    id: "roofing",
    label: "Roofing Replacement",
    emoji: "🏠",
    description: "Full tear-off & reroof · ~4 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 5, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material Order – Shingles & Underlayment", durationDays: 5, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Crew Scheduling", durationDays: 2, offsetDays: 0 },
      { phase: "Removal", name: "Tear-Off Old Roofing", durationDays: 2, offsetDays: 7, trade: "Roofing" },
      { phase: "Removal", name: "Deck Inspection", durationDays: 1, offsetDays: 9, trade: "Roofing" },
      { phase: "Removal", name: "Deck Repairs", durationDays: 2, offsetDays: 10, trade: "Roofing" },
      { phase: "Installation", name: "Underlayment & Ice Shield", durationDays: 1, offsetDays: 12, trade: "Roofing" },
      { phase: "Installation", name: "Shingle Installation", durationDays: 3, offsetDays: 13, trade: "Roofing" },
      { phase: "Installation", name: "Ridge Cap & Flashing", durationDays: 1, offsetDays: 16, trade: "Roofing" },
      { phase: "Installation", name: "Gutters & Downspouts", durationDays: 2, offsetDays: 17, trade: "Roofing" },
      { phase: "Closeout", name: "Final Inspection", durationDays: 1, offsetDays: 21, isMilestone: true },
      { phase: "Closeout", name: "Site Cleanup", durationDays: 1, offsetDays: 21 },
      { phase: "Closeout", name: "Customer Walkthrough", durationDays: 1, offsetDays: 22, isMilestone: true },
    ],
  },
  {
    id: "bathroom",
    label: "Bathroom Remodel",
    emoji: "🚿",
    description: "Full gut & remodel · ~6 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Selections", durationDays: 7, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material & Fixture Order", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Demolition", durationDays: 2, offsetDays: 10, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 1, offsetDays: 12 },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 3, offsetDays: 13, trade: "Plumbing" },
      { phase: "Rough-In", name: "Rough Electrical", durationDays: 2, offsetDays: 13, trade: "Electrical" },
      { phase: "Rough-In", name: "Backer Board / Cement Board", durationDays: 2, offsetDays: 16, trade: "Drywall" },
      { phase: "Finishes", name: "Tile – Shower & Floor", durationDays: 5, offsetDays: 18, trade: "Tile" },
      { phase: "Finishes", name: "Drywall & Painting", durationDays: 4, offsetDays: 18, trade: "Drywall" },
      { phase: "Finishes", name: "Vanity & Mirror Install", durationDays: 2, offsetDays: 23, trade: "Carpenter" },
      { phase: "Finishes", name: "Glass Shower Door", durationDays: 2, offsetDays: 25, trade: "Glass" },
      { phase: "Final", name: "Plumbing Fixtures", durationDays: 1, offsetDays: 27, trade: "Plumbing" },
      { phase: "Final", name: "Electrical Fixtures & Exhaust Fan", durationDays: 1, offsetDays: 27, trade: "Electrical" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 29, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 3, offsetDays: 30 },
    ],
  },
  {
    id: "kitchen",
    label: "Kitchen Remodel",
    emoji: "🍳",
    description: "Full gut & remodel · ~10 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Architectural Plans", durationDays: 10, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Cabinet & Material Order", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Demolition – Cabinets & Flooring", durationDays: 2, offsetDays: 14, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 1, offsetDays: 16 },
      { phase: "Rough-In", name: "Rough Plumbing Relocation", durationDays: 3, offsetDays: 17, trade: "Plumbing" },
      { phase: "Rough-In", name: "Rough Electrical – New Circuits", durationDays: 3, offsetDays: 17, trade: "Electrical" },
      { phase: "Rough-In", name: "Framing Changes", durationDays: 2, offsetDays: 17, trade: "Framing" },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 3, offsetDays: 20, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish & Prime", durationDays: 4, offsetDays: 23, trade: "Drywall" },
      { phase: "Finishes", name: "Tile Flooring", durationDays: 4, offsetDays: 27, trade: "Tile" },
      { phase: "Finishes", name: "Painting", durationDays: 3, offsetDays: 27, trade: "Painter" },
      { phase: "Finishes", name: "Cabinet Installation", durationDays: 5, offsetDays: 31, trade: "Carpenter" },
      { phase: "Finishes", name: "Countertop Template & Install", durationDays: 5, offsetDays: 36, trade: "Countertops" },
      { phase: "Finishes", name: "Tile Backsplash", durationDays: 3, offsetDays: 41, trade: "Tile" },
      { phase: "Final", name: "Appliance Installation", durationDays: 2, offsetDays: 44, trade: "Appliances" },
      { phase: "Final", name: "Plumbing Fixtures & Hookup", durationDays: 1, offsetDays: 46, trade: "Plumbing" },
      { phase: "Final", name: "Electrical Fixtures & Panel", durationDays: 1, offsetDays: 46, trade: "Electrical" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 48, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 4, offsetDays: 49 },
    ],
  },
  {
    id: "addition",
    label: "Home Addition",
    emoji: "🏗️",
    description: "New room addition · ~20 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Architectural Drawings", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Structural Engineering", durationDays: 7, offsetDays: 14 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 14, offsetDays: 21 },
      { phase: "Pre-Construction", name: "Material Procurement", durationDays: 21, offsetDays: 21 },
      { phase: "Site Work", name: "Site Preparation & Layout", durationDays: 2, offsetDays: 35, trade: "Site Work" },
      { phase: "Site Work", name: "Excavation", durationDays: 3, offsetDays: 37, trade: "Site Work" },
      { phase: "Foundation", name: "Footings – Form & Pour", durationDays: 3, offsetDays: 40, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Walls", durationDays: 5, offsetDays: 43, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Cure & Waterproofing", durationDays: 7, offsetDays: 48, trade: "Concrete" },
      { phase: "Framing", name: "Floor System", durationDays: 4, offsetDays: 55, trade: "Framing" },
      { phase: "Framing", name: "Wall Framing", durationDays: 7, offsetDays: 59, trade: "Framing" },
      { phase: "Framing", name: "Roof Framing & Sheathing", durationDays: 7, offsetDays: 66, trade: "Framing" },
      { phase: "Framing", name: "Windows & Exterior Doors", durationDays: 3, offsetDays: 66, trade: "Windows" },
      { phase: "Rough-In", name: "Rough Electrical", durationDays: 5, offsetDays: 73, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 5, offsetDays: 73, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Rough", durationDays: 4, offsetDays: 73, trade: "HVAC" },
      { phase: "Rough-In", name: "Insulation", durationDays: 3, offsetDays: 78, trade: "Insulation" },
      { phase: "Exterior", name: "Roofing", durationDays: 5, offsetDays: 73, trade: "Roofing" },
      { phase: "Exterior", name: "Exterior Siding / Stucco", durationDays: 7, offsetDays: 81, trade: "Siding" },
      { phase: "Exterior", name: "Exterior Paint", durationDays: 3, offsetDays: 88, trade: "Painter" },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 5, offsetDays: 81, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish", durationDays: 5, offsetDays: 86, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring", durationDays: 7, offsetDays: 91, trade: "Flooring" },
      { phase: "Finishes", name: "Interior Paint", durationDays: 5, offsetDays: 91, trade: "Painter" },
      { phase: "Finishes", name: "Trim & Millwork", durationDays: 5, offsetDays: 98, trade: "Carpenter" },
      { phase: "Finishes", name: "Cabinets & Countertops", durationDays: 5, offsetDays: 103, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical", durationDays: 3, offsetDays: 108, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing", durationDays: 2, offsetDays: 108, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final", durationDays: 2, offsetDays: 108, trade: "HVAC" },
      { phase: "Final", name: "Final Inspection", durationDays: 1, offsetDays: 113, isMilestone: true },
      { phase: "Final", name: "Punch List & Closeout", durationDays: 5, offsetDays: 114 },
    ],
  },
  {
    id: "renovation",
    label: "Full Interior Renovation",
    emoji: "🔨",
    description: "Full gut renovation · ~14 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Design & Selections", durationDays: 10, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Material & Fixture Orders", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 10, offsetDays: 0 },
      { phase: "Demo", name: "Full Demolition", durationDays: 5, offsetDays: 14, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal & Haul-Away", durationDays: 2, offsetDays: 19, trade: "Demo" },
      { phase: "Rough-In", name: "Rough Electrical – Full Rewire", durationDays: 7, offsetDays: 21, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 5, offsetDays: 21, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Ductwork & Rough", durationDays: 5, offsetDays: 21, trade: "HVAC" },
      { phase: "Rough-In", name: "Framing Changes", durationDays: 5, offsetDays: 21, trade: "Framing" },
      { phase: "Rough-In", name: "Insulation", durationDays: 4, offsetDays: 28, trade: "Insulation" },
      { phase: "Rough-In", name: "Inspections – Rough", durationDays: 1, offsetDays: 32, isMilestone: true },
      { phase: "Drywall", name: "Drywall Hang", durationDays: 7, offsetDays: 33, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finish – 3 Coats", durationDays: 7, offsetDays: 40, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring – All Areas", durationDays: 10, offsetDays: 47, trade: "Flooring" },
      { phase: "Finishes", name: "Interior Paint – Full House", durationDays: 10, offsetDays: 47, trade: "Painter" },
      { phase: "Finishes", name: "Tile – Kitchen & Baths", durationDays: 7, offsetDays: 47, trade: "Tile" },
      { phase: "Finishes", name: "Cabinets – Kitchen", durationDays: 5, offsetDays: 57, trade: "Carpenter" },
      { phase: "Finishes", name: "Countertops", durationDays: 5, offsetDays: 62, trade: "Countertops" },
      { phase: "Finishes", name: "Trim, Doors & Millwork", durationDays: 7, offsetDays: 57, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical & Fixtures", durationDays: 4, offsetDays: 67, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing & Fixtures", durationDays: 3, offsetDays: 67, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final & Balancing", durationDays: 2, offsetDays: 67, trade: "HVAC" },
      { phase: "Final", name: "Appliance Install", durationDays: 2, offsetDays: 71, trade: "Appliances" },
      { phase: "Final", name: "Final Inspections", durationDays: 1, offsetDays: 73, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 5, offsetDays: 74 },
      { phase: "Final", name: "Deep Clean & Move-In Ready", durationDays: 2, offsetDays: 79 },
    ],
  },
  {
    id: "custom-home-18",
    label: "Custom Home Build – 18 Months",
    emoji: "🏡",
    description: "Ground-up single story · ~540 days",
    tasks: [
      // Pre-Construction (days 0–89)
      { phase: "Pre-Construction", name: "Survey & Soil Testing", durationDays: 7, offsetDays: 0, trade: "Civil" },
      { phase: "Pre-Construction", name: "Architectural Design & Plans", durationDays: 30, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Structural Engineering", durationDays: 21, offsetDays: 30 },
      { phase: "Pre-Construction", name: "MEP Engineering", durationDays: 14, offsetDays: 30, trade: "Engineering" },
      { phase: "Pre-Construction", name: "Material & Finish Selections", durationDays: 30, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application – Building", durationDays: 7, offsetDays: 51 },
      { phase: "Pre-Construction", name: "Permit Review & Approval", durationDays: 30, offsetDays: 58 },
      { phase: "Pre-Construction", name: "Permit Issued", durationDays: 1, offsetDays: 89, isMilestone: true },
      // Site Work (days 90–119)
      { phase: "Site Work", name: "Site Clearing & Tree Removal", durationDays: 5, offsetDays: 90, trade: "Site Work" },
      { phase: "Site Work", name: "Grading & Drainage Plan", durationDays: 7, offsetDays: 95, trade: "Site Work" },
      { phase: "Site Work", name: "Underground Utilities – Water, Sewer, Electric", durationDays: 10, offsetDays: 95, trade: "Site Work" },
      { phase: "Site Work", name: "Temporary Power & Facilities", durationDays: 3, offsetDays: 90 },
      // Foundation (days 110–154)
      { phase: "Foundation", name: "Layout & Excavation", durationDays: 5, offsetDays: 110, trade: "Concrete" },
      { phase: "Foundation", name: "Footings – Form & Pour", durationDays: 7, offsetDays: 115, trade: "Concrete" },
      { phase: "Foundation", name: "Slab / Foundation Walls", durationDays: 10, offsetDays: 122, trade: "Concrete" },
      { phase: "Foundation", name: "Waterproofing & Underslab Plumbing", durationDays: 5, offsetDays: 132, trade: "Concrete" },
      { phase: "Foundation", name: "Slab Pour & Cure", durationDays: 14, offsetDays: 137, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Inspection", durationDays: 1, offsetDays: 153, isMilestone: true },
      // Framing (days 154–219)
      { phase: "Framing", name: "Floor System & Plates", durationDays: 7, offsetDays: 154, trade: "Framing" },
      { phase: "Framing", name: "Wall Framing – Exterior & Interior", durationDays: 14, offsetDays: 161, trade: "Framing" },
      { phase: "Framing", name: "Roof Framing & Sheathing", durationDays: 14, offsetDays: 175, trade: "Framing" },
      { phase: "Framing", name: "Impact Windows & Doors – Rough Frame", durationDays: 7, offsetDays: 175, trade: "Windows" },
      { phase: "Framing", name: "Sheathing & House Wrap", durationDays: 5, offsetDays: 189, trade: "Framing" },
      { phase: "Framing", name: "Framing Inspection", durationDays: 1, offsetDays: 219, isMilestone: true },
      // Roofing & Exterior (days 200–264)
      { phase: "Roofing & Exterior", name: "Roofing – Underlayment & Tile", durationDays: 14, offsetDays: 200, trade: "Roofing" },
      { phase: "Roofing & Exterior", name: "Impact Windows & Doors – Final Install", durationDays: 10, offsetDays: 200, trade: "Windows" },
      { phase: "Roofing & Exterior", name: "Stucco / Exterior Cladding", durationDays: 14, offsetDays: 214, trade: "Stucco" },
      { phase: "Roofing & Exterior", name: "Exterior Paint – Primer & 2 Coats", durationDays: 10, offsetDays: 228, trade: "Painter" },
      { phase: "Roofing & Exterior", name: "Garage Doors & Entry", durationDays: 3, offsetDays: 238, trade: "Doors" },
      // MEP Rough-In (days 220–284)
      { phase: "MEP Rough-In", name: "Rough Electrical – Full House", durationDays: 14, offsetDays: 220, trade: "Electrical" },
      { phase: "MEP Rough-In", name: "Rough Plumbing", durationDays: 14, offsetDays: 220, trade: "Plumbing" },
      { phase: "MEP Rough-In", name: "HVAC Ductwork & Air Handler", durationDays: 14, offsetDays: 220, trade: "HVAC" },
      { phase: "MEP Rough-In", name: "Fire Sprinkler Rough", durationDays: 10, offsetDays: 220, trade: "Fire Suppression" },
      { phase: "MEP Rough-In", name: "Low Voltage – Data, Security, AV Rough", durationDays: 7, offsetDays: 234, trade: "Low Voltage" },
      { phase: "MEP Rough-In", name: "Rough Inspections – MEP", durationDays: 1, offsetDays: 269, isMilestone: true },
      // Insulation & Drywall (days 270–339)
      { phase: "Insulation & Drywall", name: "Spray Foam / Batt Insulation", durationDays: 10, offsetDays: 270, trade: "Insulation" },
      { phase: "Insulation & Drywall", name: "Drywall Hang", durationDays: 14, offsetDays: 280, trade: "Drywall" },
      { phase: "Insulation & Drywall", name: "Drywall Finish – 3 Coats", durationDays: 14, offsetDays: 294, trade: "Drywall" },
      { phase: "Insulation & Drywall", name: "Drywall Prime & Texture", durationDays: 7, offsetDays: 308, trade: "Drywall" },
      // Interior Finishes (days 315–459)
      { phase: "Interior Finishes", name: "Interior Paint – Full House", durationDays: 21, offsetDays: 315, trade: "Painter" },
      { phase: "Interior Finishes", name: "Flooring – Tile & Wood", durationDays: 21, offsetDays: 315, trade: "Flooring" },
      { phase: "Interior Finishes", name: "Kitchen Cabinets & Island", durationDays: 14, offsetDays: 336, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Countertops – Template & Fabrication", durationDays: 14, offsetDays: 350, trade: "Countertops" },
      { phase: "Interior Finishes", name: "Kitchen Backsplash & Bath Tile", durationDays: 14, offsetDays: 336, trade: "Tile" },
      { phase: "Interior Finishes", name: "Interior Doors, Trim & Millwork", durationDays: 21, offsetDays: 336, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Closet Systems & Built-Ins", durationDays: 10, offsetDays: 357, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Shower Glass Enclosures", durationDays: 7, offsetDays: 367, trade: "Glass" },
      { phase: "Interior Finishes", name: "Stairs & Railings", durationDays: 10, offsetDays: 357, trade: "Carpenter" },
      // Final MEP & Fixtures (days 390–449)
      { phase: "Final MEP & Fixtures", name: "Final Electrical – Devices & Fixtures", durationDays: 14, offsetDays: 390, trade: "Electrical" },
      { phase: "Final MEP & Fixtures", name: "Final Plumbing – Fixtures & Trim", durationDays: 10, offsetDays: 390, trade: "Plumbing" },
      { phase: "Final MEP & Fixtures", name: "HVAC Final & Balancing", durationDays: 7, offsetDays: 390, trade: "HVAC" },
      { phase: "Final MEP & Fixtures", name: "Low Voltage – Terminations & Programming", durationDays: 7, offsetDays: 404, trade: "Low Voltage" },
      { phase: "Final MEP & Fixtures", name: "Appliance Installation", durationDays: 5, offsetDays: 411, trade: "Appliances" },
      { phase: "Final MEP & Fixtures", name: "Fire Sprinkler Final", durationDays: 3, offsetDays: 411, trade: "Fire Suppression" },
      // Landscaping & Site (days 430–489)
      { phase: "Landscaping & Site", name: "Driveway & Walkways", durationDays: 7, offsetDays: 430, trade: "Concrete" },
      { phase: "Landscaping & Site", name: "Landscaping & Sod", durationDays: 14, offsetDays: 437, trade: "Landscaping" },
      { phase: "Landscaping & Site", name: "Irrigation System", durationDays: 7, offsetDays: 437, trade: "Landscaping" },
      { phase: "Landscaping & Site", name: "Fence & Gate", durationDays: 5, offsetDays: 451, trade: "Fence" },
      // Final Inspections & CO (days 490–539)
      { phase: "Closeout", name: "Final MEP Inspections", durationDays: 1, offsetDays: 490, isMilestone: true },
      { phase: "Closeout", name: "Final Building Inspection", durationDays: 1, offsetDays: 500, isMilestone: true },
      { phase: "Closeout", name: "Certificate of Occupancy", durationDays: 1, offsetDays: 515, isMilestone: true },
      { phase: "Closeout", name: "Punch List", durationDays: 14, offsetDays: 516 },
      { phase: "Closeout", name: "Deep Clean & Final Walkthrough", durationDays: 3, offsetDays: 530 },
      { phase: "Closeout", name: "Move-In Ready", durationDays: 1, offsetDays: 539, isMilestone: true },
    ],
  },
  {
    id: "custom-home-24",
    label: "Custom Luxury Home – 24 Months",
    emoji: "🏰",
    description: "Ground-up two-story luxury · ~720 days",
    tasks: [
      // Pre-Construction (days 0–119)
      { phase: "Pre-Construction", name: "Survey, Soil & Environmental Testing", durationDays: 14, offsetDays: 0, trade: "Civil" },
      { phase: "Pre-Construction", name: "Architectural Design – Schematic", durationDays: 30, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Architectural Design – Design Development", durationDays: 30, offsetDays: 30 },
      { phase: "Pre-Construction", name: "Architectural Construction Documents", durationDays: 21, offsetDays: 60 },
      { phase: "Pre-Construction", name: "Structural & Civil Engineering", durationDays: 30, offsetDays: 45 },
      { phase: "Pre-Construction", name: "MEP Engineering", durationDays: 21, offsetDays: 60, trade: "Engineering" },
      { phase: "Pre-Construction", name: "Interior Design & Finish Selections", durationDays: 60, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application – Full Package", durationDays: 7, offsetDays: 81 },
      { phase: "Pre-Construction", name: "Permit Review, Revisions & Resubmittal", durationDays: 30, offsetDays: 88 },
      { phase: "Pre-Construction", name: "Permit Issued", durationDays: 1, offsetDays: 119, isMilestone: true },
      // Site Work (days 120–159)
      { phase: "Site Work", name: "Site Clearing, Grading & Tree Removal", durationDays: 7, offsetDays: 120, trade: "Site Work" },
      { phase: "Site Work", name: "Underground Utilities – Water, Sewer, Electric, Gas", durationDays: 14, offsetDays: 127, trade: "Site Work" },
      { phase: "Site Work", name: "Retaining Walls & Site Grading", durationDays: 14, offsetDays: 127, trade: "Civil" },
      { phase: "Site Work", name: "Temporary Power & Site Setup", durationDays: 3, offsetDays: 120 },
      // Foundation (days 155–219)
      { phase: "Foundation", name: "Layout, Excavation & Piling", durationDays: 10, offsetDays: 155, trade: "Concrete" },
      { phase: "Foundation", name: "Deep Footings & Grade Beams", durationDays: 14, offsetDays: 165, trade: "Concrete" },
      { phase: "Foundation", name: "Underslab Plumbing & Conduit", durationDays: 7, offsetDays: 165, trade: "Plumbing" },
      { phase: "Foundation", name: "Stem Walls & Waterproofing", durationDays: 10, offsetDays: 179, trade: "Concrete" },
      { phase: "Foundation", name: "Slab – Form, Rebar, Pour & Cure", durationDays: 21, offsetDays: 189, trade: "Concrete" },
      { phase: "Foundation", name: "Foundation Inspection", durationDays: 1, offsetDays: 219, isMilestone: true },
      // Framing (days 220–349)
      { phase: "Framing", name: "First Floor Framing", durationDays: 21, offsetDays: 220, trade: "Framing" },
      { phase: "Framing", name: "Second Floor Deck & Framing", durationDays: 21, offsetDays: 241, trade: "Framing" },
      { phase: "Framing", name: "Roof Framing – Complex Hip / Trusses", durationDays: 21, offsetDays: 262, trade: "Framing" },
      { phase: "Framing", name: "Roof Sheathing & Weather Barrier", durationDays: 7, offsetDays: 283, trade: "Framing" },
      { phase: "Framing", name: "Impact Windows & Doors – Rough Frame", durationDays: 14, offsetDays: 262, trade: "Windows" },
      { phase: "Framing", name: "Sheathing, Bracing & Fastening", durationDays: 10, offsetDays: 290, trade: "Framing" },
      { phase: "Framing", name: "Framing Inspection", durationDays: 1, offsetDays: 349, isMilestone: true },
      // Roofing & Exterior (days 300–399)
      { phase: "Roofing & Exterior", name: "Roofing – Tile / Metal / Flat Sections", durationDays: 21, offsetDays: 300, trade: "Roofing" },
      { phase: "Roofing & Exterior", name: "Skylights & Roof Penetrations", durationDays: 5, offsetDays: 321, trade: "Roofing" },
      { phase: "Roofing & Exterior", name: "Impact Windows & Doors – Final Install", durationDays: 14, offsetDays: 300, trade: "Windows" },
      { phase: "Roofing & Exterior", name: "Stucco – Scratch, Brown & Finish Coat", durationDays: 21, offsetDays: 321, trade: "Stucco" },
      { phase: "Roofing & Exterior", name: "Exterior Paint – Primer & 2 Coats", durationDays: 14, offsetDays: 342, trade: "Painter" },
      { phase: "Roofing & Exterior", name: "Balconies, Railings & Exterior Metal", durationDays: 10, offsetDays: 342, trade: "Ironwork" },
      { phase: "Roofing & Exterior", name: "Garage Doors & Entry Gates", durationDays: 5, offsetDays: 356, trade: "Doors" },
      // MEP Rough-In (days 350–449)
      { phase: "MEP Rough-In", name: "Rough Electrical – Full House (2 Floors)", durationDays: 21, offsetDays: 350, trade: "Electrical" },
      { phase: "MEP Rough-In", name: "Rough Plumbing – All Baths & Kitchen", durationDays: 21, offsetDays: 350, trade: "Plumbing" },
      { phase: "MEP Rough-In", name: "HVAC Ductwork, Zones & Air Handlers", durationDays: 21, offsetDays: 350, trade: "HVAC" },
      { phase: "MEP Rough-In", name: "Fire Sprinkler Rough", durationDays: 14, offsetDays: 350, trade: "Fire Suppression" },
      { phase: "MEP Rough-In", name: "Generator & Transfer Switch Rough", durationDays: 7, offsetDays: 364, trade: "Electrical" },
      { phase: "MEP Rough-In", name: "Low Voltage – Data, Security, AV, Smart Home", durationDays: 14, offsetDays: 371, trade: "Low Voltage" },
      { phase: "MEP Rough-In", name: "Gas Piping Rough", durationDays: 7, offsetDays: 371, trade: "Plumbing" },
      { phase: "MEP Rough-In", name: "Rough Inspections – MEP", durationDays: 1, offsetDays: 419, isMilestone: true },
      // Insulation & Drywall (days 420–524)
      { phase: "Insulation & Drywall", name: "Spray Foam Insulation – Roof Deck & Walls", durationDays: 14, offsetDays: 420, trade: "Insulation" },
      { phase: "Insulation & Drywall", name: "Batt Insulation – Interior Walls", durationDays: 7, offsetDays: 434, trade: "Insulation" },
      { phase: "Insulation & Drywall", name: "Drywall Hang – Both Floors", durationDays: 21, offsetDays: 441, trade: "Drywall" },
      { phase: "Insulation & Drywall", name: "Drywall Finish – 3 Coats", durationDays: 21, offsetDays: 462, trade: "Drywall" },
      { phase: "Insulation & Drywall", name: "Drywall Prime & Skim Coat", durationDays: 14, offsetDays: 483, trade: "Drywall" },
      // Interior Finishes (days 497–629)
      { phase: "Interior Finishes", name: "Interior Paint – Full House, All Floors", durationDays: 28, offsetDays: 497, trade: "Painter" },
      { phase: "Interior Finishes", name: "Flooring – Marble, Wood & Tile", durationDays: 28, offsetDays: 497, trade: "Flooring" },
      { phase: "Interior Finishes", name: "Kitchen Cabinets – Custom", durationDays: 21, offsetDays: 525, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Countertops – Custom Stone Fabrication", durationDays: 21, offsetDays: 546, trade: "Countertops" },
      { phase: "Interior Finishes", name: "Kitchen Backsplash – Custom Tile", durationDays: 14, offsetDays: 525, trade: "Tile" },
      { phase: "Interior Finishes", name: "Bath Tile – All Baths", durationDays: 21, offsetDays: 525, trade: "Tile" },
      { phase: "Interior Finishes", name: "Custom Millwork – Trim, Coffered Ceilings, Wainscoting", durationDays: 28, offsetDays: 525, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Stairs, Railings & Balustrades", durationDays: 14, offsetDays: 553, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Closet Systems & Walk-In Wardrobes", durationDays: 14, offsetDays: 553, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Custom Built-Ins & Entertainment Center", durationDays: 14, offsetDays: 553, trade: "Carpenter" },
      { phase: "Interior Finishes", name: "Shower Glass – Frameless Enclosures", durationDays: 10, offsetDays: 567, trade: "Glass" },
      { phase: "Interior Finishes", name: "Specialty Ceilings – Plaster / Tray", durationDays: 14, offsetDays: 553, trade: "Drywall" },
      // Final MEP & Fixtures (days 580–649)
      { phase: "Final MEP & Fixtures", name: "Final Electrical – Devices, Fixtures & Panel", durationDays: 14, offsetDays: 580, trade: "Electrical" },
      { phase: "Final MEP & Fixtures", name: "Final Plumbing – Fixtures & Trim", durationDays: 14, offsetDays: 580, trade: "Plumbing" },
      { phase: "Final MEP & Fixtures", name: "HVAC Final & Balancing", durationDays: 10, offsetDays: 580, trade: "HVAC" },
      { phase: "Final MEP & Fixtures", name: "Generator Install & Commissioning", durationDays: 7, offsetDays: 594, trade: "Electrical" },
      { phase: "Final MEP & Fixtures", name: "Smart Home / AV System Setup", durationDays: 14, offsetDays: 594, trade: "Low Voltage" },
      { phase: "Final MEP & Fixtures", name: "Premium Appliance Installation", durationDays: 7, offsetDays: 608, trade: "Appliances" },
      { phase: "Final MEP & Fixtures", name: "Fire Sprinkler Final", durationDays: 3, offsetDays: 608, trade: "Fire Suppression" },
      { phase: "Final MEP & Fixtures", name: "Custom Lighting Fixtures", durationDays: 7, offsetDays: 615, trade: "Electrical" },
      // Pool & Outdoor (days 580–659)
      { phase: "Pool & Outdoor Living", name: "Pool / Spa Excavation & Shell", durationDays: 21, offsetDays: 580, trade: "Pool" },
      { phase: "Pool & Outdoor Living", name: "Pool Plumbing & Equipment", durationDays: 14, offsetDays: 601, trade: "Pool" },
      { phase: "Pool & Outdoor Living", name: "Pool Tile & Coping", durationDays: 10, offsetDays: 615, trade: "Pool" },
      { phase: "Pool & Outdoor Living", name: "Outdoor Kitchen & Summer Kitchen", durationDays: 14, offsetDays: 594, trade: "Outdoor" },
      { phase: "Pool & Outdoor Living", name: "Driveway, Pavers & Walkways", durationDays: 14, offsetDays: 594, trade: "Concrete" },
      { phase: "Pool & Outdoor Living", name: "Landscaping, Sod & Irrigation", durationDays: 21, offsetDays: 625, trade: "Landscaping" },
      { phase: "Pool & Outdoor Living", name: "Fence, Gate & Security Perimeter", durationDays: 7, offsetDays: 646, trade: "Fence" },
      // Closeout (days 660–719)
      { phase: "Closeout", name: "Final MEP Inspections", durationDays: 1, offsetDays: 660, isMilestone: true },
      { phase: "Closeout", name: "Final Building Inspection", durationDays: 1, offsetDays: 672, isMilestone: true },
      { phase: "Closeout", name: "Pool Final Inspection", durationDays: 1, offsetDays: 672, isMilestone: true },
      { phase: "Closeout", name: "Certificate of Occupancy", durationDays: 1, offsetDays: 690, isMilestone: true },
      { phase: "Closeout", name: "Punch List", durationDays: 21, offsetDays: 691 },
      { phase: "Closeout", name: "Final Detail Clean", durationDays: 5, offsetDays: 712 },
      { phase: "Closeout", name: "Client Walkthrough & Move-In Ready", durationDays: 1, offsetDays: 719, isMilestone: true },
    ],
  },
  {
    id: "commercial",
    label: "Commercial Build-Out",
    emoji: "🏢",
    description: "Office / retail build-out · ~22 weeks",
    tasks: [
      { phase: "Pre-Construction", name: "Space Planning & Design", durationDays: 14, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Architectural & Engineering Drawings", durationDays: 21, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Permit Application", durationDays: 21, offsetDays: 21 },
      { phase: "Pre-Construction", name: "Material & Equipment Procurement", durationDays: 21, offsetDays: 21 },
      { phase: "Demo", name: "Demolition – Existing Build-Out", durationDays: 7, offsetDays: 42, trade: "Demo" },
      { phase: "Demo", name: "Debris Removal", durationDays: 2, offsetDays: 49, trade: "Demo" },
      { phase: "Rough-In", name: "Structural – New Walls & Openings", durationDays: 10, offsetDays: 51, trade: "Framing" },
      { phase: "Rough-In", name: "Rough Electrical – New Service", durationDays: 10, offsetDays: 51, trade: "Electrical" },
      { phase: "Rough-In", name: "Rough Plumbing", durationDays: 7, offsetDays: 51, trade: "Plumbing" },
      { phase: "Rough-In", name: "HVAC Ductwork", durationDays: 10, offsetDays: 51, trade: "HVAC" },
      { phase: "Rough-In", name: "Fire Sprinkler Rough", durationDays: 7, offsetDays: 51, trade: "Fire Suppression" },
      { phase: "Rough-In", name: "Low Voltage – Data & A/V Rough", durationDays: 5, offsetDays: 51, trade: "Low Voltage" },
      { phase: "Rough-In", name: "Rough Inspections", durationDays: 1, offsetDays: 62, isMilestone: true },
      { phase: "Drywall", name: "Insulation", durationDays: 4, offsetDays: 63, trade: "Insulation" },
      { phase: "Drywall", name: "Drywall Hang & Finish", durationDays: 14, offsetDays: 67, trade: "Drywall" },
      { phase: "Finishes", name: "Flooring – LVT / Carpet / Tile", durationDays: 10, offsetDays: 81, trade: "Flooring" },
      { phase: "Finishes", name: "Paint & Wall Finishes", durationDays: 10, offsetDays: 81, trade: "Painter" },
      { phase: "Finishes", name: "Acoustical Ceiling", durationDays: 7, offsetDays: 81, trade: "Ceiling" },
      { phase: "Finishes", name: "Storefront & Glass", durationDays: 5, offsetDays: 81, trade: "Glass" },
      { phase: "Finishes", name: "Interior Doors & Hardware", durationDays: 5, offsetDays: 91, trade: "Carpenter" },
      { phase: "Finishes", name: "Millwork & Casework", durationDays: 7, offsetDays: 91, trade: "Carpenter" },
      { phase: "Final", name: "Final Electrical & Fixtures", durationDays: 5, offsetDays: 98, trade: "Electrical" },
      { phase: "Final", name: "Final Plumbing & Fixtures", durationDays: 3, offsetDays: 98, trade: "Plumbing" },
      { phase: "Final", name: "HVAC Final & Balancing", durationDays: 4, offsetDays: 98, trade: "HVAC" },
      { phase: "Final", name: "Low Voltage – Terminations", durationDays: 4, offsetDays: 98, trade: "Low Voltage" },
      { phase: "Final", name: "Sprinkler Final", durationDays: 2, offsetDays: 102, trade: "Fire Suppression" },
      { phase: "Final", name: "Final Building Inspection", durationDays: 1, offsetDays: 105, isMilestone: true },
      { phase: "Final", name: "Punch List", durationDays: 7, offsetDays: 106 },
      { phase: "Final", name: "Certificate of Occupancy", durationDays: 1, offsetDays: 113, isMilestone: true },
    ],
  },
  {
    id: "additions-v1",
    label: "Additions v1",
    emoji: "🏗️",
    description: "Home addition · full WBS hierarchy · ~169 days",
    tasks: [
      // ── ROOT ─────────────────────────────────────────────────────────────────
      { localId: "root", phase: "Project", name: "Allisons Addition", durationDays: 169, offsetDays: 0 },

      // ── SHELL ────────────────────────────────────────────────────────────────
      { localId: "shell", phase: "Shell", name: "Shell", durationDays: 44, offsetDays: 0, parentRef: "root" },

      // Pre-Construction (under Shell)
      { localId: "demo", phase: "Shell", name: "Demolition existing wood structure", durationDays: 3, offsetDays: 0, parentRef: "shell" },
      { localId: "excav", phase: "Shell", name: "Excavation", durationDays: 3, offsetDays: 3, parentRef: "shell", predecessorRefs: ["demo"] },

      // Footings
      { localId: "footings", phase: "Shell", name: "Footings", durationDays: 6, offsetDays: 6, parentRef: "shell", predecessorRefs: ["excav"] },
      { localId: "forming", phase: "Shell", name: "Forming", durationDays: 1, offsetDays: 6, parentRef: "footings" },
      { localId: "foot-rebars", phase: "Shell", name: "Footings Rebars Installation", durationDays: 3, offsetDays: 7, parentRef: "footings", trade: "Concrete", predecessorRefs: ["forming"] },
      { localId: "foot-insp", phase: "Shell", name: "Footings Inspection", durationDays: 1, offsetDays: 10, parentRef: "footings", isMilestone: true, predecessorRefs: ["foot-rebars"] },
      { localId: "foot-pour", phase: "Shell", name: "Footings Pouring Concrete", durationDays: 1, offsetDays: 11, parentRef: "footings", trade: "Concrete", predecessorRefs: ["foot-insp"] },

      // 1st Lift
      { localId: "1st-lift", phase: "Shell", name: "1st Lift", durationDays: 4, offsetDays: 12, parentRef: "shell", predecessorRefs: ["foot-pour"] },
      { localId: "lift-col", phase: "Shell", name: "1st Lift Columns", durationDays: 4, offsetDays: 12, parentRef: "1st-lift", trade: "Concrete" },
      { localId: "lift-blk", phase: "Shell", name: "1st Lift Blocks", durationDays: 4, offsetDays: 12, parentRef: "1st-lift", trade: "Masonry", predecessorRefs: ["lift-col"] },

      // Slab on Grade
      { localId: "sog", phase: "Shell", name: "Slab on Grade", durationDays: 6, offsetDays: 16, parentRef: "shell", predecessorRefs: ["lift-blk"] },
      { localId: "sog-rebars", phase: "Shell", name: "SOG Rebars Installation", durationDays: 4, offsetDays: 16, parentRef: "sog", trade: "Concrete" },
      { localId: "sog-insp", phase: "Shell", name: "SOG Inspection", durationDays: 1, offsetDays: 20, parentRef: "sog", isMilestone: true, predecessorRefs: ["sog-rebars"] },
      { localId: "sog-pour", phase: "Shell", name: "SOG Pouring Concrete", durationDays: 1, offsetDays: 21, parentRef: "sog", trade: "Concrete", predecessorRefs: ["sog-insp"] },

      // Tie Beam
      { localId: "tie-beam", phase: "Shell", name: "Tie Beam", durationDays: 7, offsetDays: 22, parentRef: "shell", predecessorRefs: ["sog-pour"] },
      { localId: "tb-rebars", phase: "Shell", name: "Tie Beam Rebars Installation", durationDays: 5, offsetDays: 22, parentRef: "tie-beam", trade: "Concrete" },
      { localId: "tb-insp", phase: "Shell", name: "Tie Beam Rebars Inspection", durationDays: 1, offsetDays: 27, parentRef: "tie-beam", isMilestone: true, predecessorRefs: ["tb-rebars"] },
      { localId: "tb-pour", phase: "Shell", name: "Tie Beam Pouring Concrete", durationDays: 1, offsetDays: 28, parentRef: "tie-beam", trade: "Concrete", predecessorRefs: ["tb-insp"] },

      // Trusses
      { localId: "trusses", phase: "Shell", name: "Trusses", durationDays: 15, offsetDays: 29, parentRef: "shell", predecessorRefs: ["tb-pour"] },
      { localId: "truss-inst", phase: "Shell", name: "Trusses Installation", durationDays: 10, offsetDays: 29, parentRef: "trusses", trade: "Framing" },
      { localId: "plywood", phase: "Shell", name: "Plywood Sheathing", durationDays: 5, offsetDays: 39, parentRef: "trusses", trade: "Framing", predecessorRefs: ["truss-inst"] },

      // ── PLUMBING ─────────────────────────────────────────────────────────────
      { localId: "plumbing", phase: "Plumbing", name: "Plumbing", durationDays: 82, offsetDays: 12, parentRef: "root" },
      { localId: "plumb-ug", phase: "Plumbing", name: "Plumbing Underground", durationDays: 5, offsetDays: 12, parentRef: "plumbing" },
      { localId: "plumb-ug-inst", phase: "Plumbing", name: "Plumbing Underground Installation", durationDays: 4, offsetDays: 12, parentRef: "plumb-ug", trade: "Plumbing" },
      { localId: "plumb-ug-insp", phase: "Plumbing", name: "Plumbing Underground Inspection", durationDays: 1, offsetDays: 16, parentRef: "plumb-ug", isMilestone: true, predecessorRefs: ["plumb-ug-inst"] },
      { localId: "plumb-rough", phase: "Plumbing", name: "Plumbing Rough Installation", durationDays: 1, offsetDays: 45, parentRef: "plumbing", trade: "Plumbing", predecessorRefs: ["plumb-ug-insp"] },
      { localId: "plumb-rough-insp", phase: "Plumbing", name: "Plumbing Rough Inspection", durationDays: 1, offsetDays: 46, parentRef: "plumbing", isMilestone: true, predecessorRefs: ["plumb-rough"] },
      { localId: "plumb-toilets", phase: "Plumbing", name: "Toilets Installation", durationDays: 1, offsetDays: 90, parentRef: "plumbing", trade: "Plumbing" },
      { localId: "plumb-vanity", phase: "Plumbing", name: "Vanity Installation", durationDays: 1, offsetDays: 91, parentRef: "plumbing", trade: "Plumbing", predecessorRefs: ["plumb-toilets"] },
      { localId: "plumb-tub", phase: "Plumbing", name: "Bathtub Installation", durationDays: 1, offsetDays: 92, parentRef: "plumbing", trade: "Plumbing", predecessorRefs: ["plumb-vanity"] },
      { localId: "plumb-final", phase: "Plumbing", name: "Plumbing Final Inspection", durationDays: 1, offsetDays: 93, parentRef: "plumbing", isMilestone: true, predecessorRefs: ["plumb-tub"] },

      // ── ELECTRICAL ───────────────────────────────────────────────────────────
      { localId: "elec", phase: "Electrical", name: "Electrical", durationDays: 78, offsetDays: 12, parentRef: "root" },
      { localId: "elec-ug", phase: "Electrical", name: "Electrical Underground", durationDays: 1, offsetDays: 12, parentRef: "elec", trade: "Electrical" },
      { localId: "elec-rough", phase: "Electrical", name: "Electrical Rough", durationDays: 5, offsetDays: 45, parentRef: "elec", trade: "Electrical", predecessorRefs: ["elec-ug"] },
      { localId: "elec-rough-insp", phase: "Electrical", name: "Electrical Rough Inspection", durationDays: 1, offsetDays: 50, parentRef: "elec", isMilestone: true, predecessorRefs: ["elec-rough"] },
      { localId: "elec-trims", phase: "Electrical", name: "Electrical Trims and Outlets", durationDays: 4, offsetDays: 85, parentRef: "elec", trade: "Electrical", predecessorRefs: ["elec-rough-insp"] },
      { localId: "elec-final", phase: "Electrical", name: "Electrical Final Inspection", durationDays: 1, offsetDays: 89, parentRef: "elec", isMilestone: true, predecessorRefs: ["elec-trims"] },

      // ── ROOF ─────────────────────────────────────────────────────────────────
      { localId: "roof", phase: "Roof", name: "Roof", durationDays: 6, offsetDays: 44, parentRef: "root", predecessorRefs: ["plywood"] },
      { localId: "roof-inst", phase: "Roof", name: "Flat Roof Installation", durationDays: 5, offsetDays: 44, parentRef: "roof", trade: "Roofing" },
      { localId: "roof-insp", phase: "Roof", name: "Flat Roof Final Inspection", durationDays: 1, offsetDays: 49, parentRef: "roof", isMilestone: true, predecessorRefs: ["roof-inst"] },

      // ── WINDOWS ──────────────────────────────────────────────────────────────
      { localId: "windows", phase: "Windows", name: "Windows", durationDays: 4, offsetDays: 45, parentRef: "root", predecessorRefs: ["roof-insp"] },
      { localId: "win-inst", phase: "Windows", name: "Windows Installation", durationDays: 3, offsetDays: 45, parentRef: "windows", trade: "Windows" },
      { localId: "win-insp", phase: "Windows", name: "Windows Inspection", durationDays: 1, offsetDays: 48, parentRef: "windows", isMilestone: true, predecessorRefs: ["win-inst"] },

      // ── DRYWALL ──────────────────────────────────────────────────────────────
      { localId: "drywall", phase: "Drywall", name: "Drywall", durationDays: 40, offsetDays: 51, parentRef: "root", predecessorRefs: ["elec-rough-insp", "plumb-rough-insp"] },
      { localId: "wall-insul", phase: "Drywall", name: "Wall Insulation", durationDays: 3, offsetDays: 51, parentRef: "drywall", trade: "Insulation" },
      { localId: "roof-insul", phase: "Drywall", name: "Roof Insulation", durationDays: 4, offsetDays: 51, parentRef: "drywall", trade: "Insulation" },
      { localId: "insul-insp", phase: "Drywall", name: "Insulation Inspection", durationDays: 1, offsetDays: 55, parentRef: "drywall", isMilestone: true, predecessorRefs: ["roof-insul"] },
      { localId: "framing-inst", phase: "Drywall", name: "Framing Installation", durationDays: 5, offsetDays: 56, parentRef: "drywall", trade: "Framing", predecessorRefs: ["insul-insp"] },
      { localId: "framing-insp", phase: "Drywall", name: "Framing Inspection", durationDays: 1, offsetDays: 61, parentRef: "drywall", isMilestone: true, predecessorRefs: ["framing-inst"] },
      { localId: "dw-hang", phase: "Drywall", name: "Drywall Hanging", durationDays: 10, offsetDays: 62, parentRef: "drywall", trade: "Drywall", predecessorRefs: ["framing-insp"] },
      { localId: "dw-insp", phase: "Drywall", name: "Drywall Inspection", durationDays: 1, offsetDays: 72, parentRef: "drywall", isMilestone: true, predecessorRefs: ["dw-hang"] },
      { localId: "dw-finish", phase: "Drywall", name: "Drywall Finish", durationDays: 7, offsetDays: 73, parentRef: "drywall", trade: "Drywall", predecessorRefs: ["dw-insp"] },
      { localId: "dw-touch", phase: "Drywall", name: "Drywall Finishes Touchup", durationDays: 1, offsetDays: 80, parentRef: "drywall", trade: "Drywall", predecessorRefs: ["dw-finish"] },
      { localId: "ceil-paint", phase: "Drywall", name: "Ceilings Paint", durationDays: 3, offsetDays: 81, parentRef: "drywall", trade: "Painter", predecessorRefs: ["dw-touch"] },
      { localId: "wall-paint", phase: "Drywall", name: "Wall Paint", durationDays: 7, offsetDays: 84, parentRef: "drywall", trade: "Painter", predecessorRefs: ["ceil-paint"] },

      // ── TILES ────────────────────────────────────────────────────────────────
      { localId: "tiles", phase: "Tiles", name: "Tiles", durationDays: 12, offsetDays: 91, parentRef: "root", predecessorRefs: ["wall-paint"] },
      { localId: "floor-tiles", phase: "Tiles", name: "Flooring Tiles", durationDays: 7, offsetDays: 91, parentRef: "tiles", trade: "Tile" },
      { localId: "bath-tiles", phase: "Tiles", name: "Bathroom Wall Tiles", durationDays: 5, offsetDays: 91, parentRef: "tiles", trade: "Tile" },

      // ── FINE CARPENTRY ───────────────────────────────────────────────────────
      { localId: "carpentry", phase: "Fine Carpentry", name: "Fine Carpentry", durationDays: 18, offsetDays: 103, parentRef: "root", predecessorRefs: ["tiles"] },
      { localId: "baseboards", phase: "Fine Carpentry", name: "Baseboards Installation", durationDays: 10, offsetDays: 103, parentRef: "carpentry", trade: "Carpenter" },
      { localId: "doors", phase: "Fine Carpentry", name: "Doors Installation", durationDays: 3, offsetDays: 103, parentRef: "carpentry", trade: "Carpenter" },
      { localId: "door-casings", phase: "Fine Carpentry", name: "Doors Casings Installation", durationDays: 5, offsetDays: 106, parentRef: "carpentry", trade: "Carpenter", predecessorRefs: ["doors"] },

      // ── EXTERIOR ─────────────────────────────────────────────────────────────
      { localId: "exterior", phase: "Exterior", name: "Exterior", durationDays: 120, offsetDays: 29, parentRef: "root" },
      { localId: "stucco", phase: "Exterior", name: "Stucco", durationDays: 60, offsetDays: 29, parentRef: "exterior", trade: "Stucco" },
      { localId: "ext-paint", phase: "Exterior", name: "Exterior Paint", durationDays: 60, offsetDays: 89, parentRef: "exterior", trade: "Painter", predecessorRefs: ["stucco"] },

      // ── HVAC ─────────────────────────────────────────────────────────────────
      { localId: "hvac", phase: "HVAC", name: "HVAC", durationDays: 5, offsetDays: 51, parentRef: "root" },
      { localId: "hvac-ducts", phase: "HVAC", name: "HVAC Ducts Installation", durationDays: 3, offsetDays: 51, parentRef: "hvac", trade: "HVAC" },
      { localId: "hvac-rough-insp", phase: "HVAC", name: "HVAC Rough Inspection", durationDays: 1, offsetDays: 54, parentRef: "hvac", isMilestone: true, predecessorRefs: ["hvac-ducts"] },
      { localId: "hvac-split", phase: "HVAC", name: "HVAC Mini Split Installation", durationDays: 1, offsetDays: 55, parentRef: "hvac", trade: "HVAC", predecessorRefs: ["hvac-rough-insp"] },
      { localId: "hvac-final", phase: "HVAC", name: "HVAC Final Inspection", durationDays: 1, offsetDays: 56, parentRef: "hvac", isMilestone: true, predecessorRefs: ["hvac-split"] },

      // ── CLOSEOUT ─────────────────────────────────────────────────────────────
      { localId: "closeout", phase: "Closeout", name: "Closeout", durationDays: 2, offsetDays: 167, parentRef: "root", predecessorRefs: ["carpentry", "ext-paint", "hvac-final", "plumb-final", "elec-final"] },
      { localId: "final-clean", phase: "Closeout", name: "Final Cleaning", durationDays: 1, offsetDays: 167, parentRef: "closeout", predecessorRefs: ["closeout"] },
      { localId: "bldg-final", phase: "Closeout", name: "Building Final Inspection", durationDays: 1, offsetDays: 168, parentRef: "closeout", isMilestone: true, predecessorRefs: ["final-clean"] },
    ],
  },
  {
    id: "additions-v2",
    label: "Additions v2",
    emoji: "🏗️",
    description: "Allison's Addition · updated WBS hierarchy · linked from/to respected",
    tasks: [
      // ── ROOT ──────────────────────────────────────────────────────────────────
      { localId: "root", phase: "Project", name: "Allison's Addition", durationDays: 100, offsetDays: 0 },

      // ── ARCHITECT'S DELAY (WBS 1.14) — predecessor to Forming ─────────────────
      { localId: "arch-delay", phase: "Delays", name: "Architect's Delay", durationDays: 1, offsetDays: 0, parentRef: "root" },

      // ── SHELL ────────────────────────────────────────────────────────────────
      { localId: "shell", phase: "Shell", name: "Shell", durationDays: 32, offsetDays: 0, parentRef: "root" },

      // Existing Conditions (WBS 1.1.1)
      { localId: "existing-cond", phase: "Shell", name: "Existing Conditions", durationDays: 3, offsetDays: 0, parentRef: "shell" },
      { localId: "demo", phase: "Shell", name: "Demolition existing wood structure", durationDays: 2, offsetDays: 0, parentRef: "existing-cond" },
      { localId: "excav", phase: "Shell", name: "Excavation", durationDays: 1, offsetDays: 2, parentRef: "existing-cond", predecessorRefs: ["demo"] },

      // Footings (WBS 1.1.2)
      { localId: "footings", phase: "Shell", name: "Footings", durationDays: 5, offsetDays: 2, parentRef: "shell" },
      { localId: "forming", phase: "Shell", name: "Forming", durationDays: 1, offsetDays: 2, parentRef: "footings", predecessorRefs: ["arch-delay"] },
      { localId: "foot-rebars", phase: "Shell", name: "Footings Rebars Installation", durationDays: 3, offsetDays: 3, parentRef: "footings", trade: "Concrete", predecessorRefs: ["forming"] },
      { localId: "foot-insp", phase: "Shell", name: "Footings Inspection", durationDays: 1, offsetDays: 6, parentRef: "footings", isMilestone: true, predecessorRefs: ["foot-rebars"] },
      { localId: "foot-pour", phase: "Shell", name: "Footings Pouring Concrete", durationDays: 1, offsetDays: 7, parentRef: "footings", trade: "Concrete", predecessorRefs: ["foot-insp"] },

      // Slab on Grade section (WBS 1.1.3) — sog-rebars links to plumb-ug-insp below
      { localId: "sog", phase: "Shell", name: "Slab on Grade", durationDays: 6, offsetDays: 17, parentRef: "shell" },

      // 1st Lift (WBS 1.1.4)
      { localId: "lift", phase: "Shell", name: "1st Lift", durationDays: 4, offsetDays: 8, parentRef: "shell" },
      { localId: "lift-col", phase: "Shell", name: "1st Lift Columns", durationDays: 4, offsetDays: 8, parentRef: "lift" },
      { localId: "lift-blk", phase: "Shell", name: "1st Lift Blocks", durationDays: 4, offsetDays: 8, parentRef: "lift" },

      // Tie Beam (WBS 1.1.5)
      { localId: "tie-beam", phase: "Shell", name: "Tie Beam", durationDays: 7, offsetDays: 12, parentRef: "shell" },
      { localId: "tb-rebars", phase: "Shell", name: "Tie Beam Rebars Installation", durationDays: 5, offsetDays: 12, parentRef: "tie-beam", trade: "Concrete", predecessorRefs: ["lift-blk"] },
      { localId: "tb-insp", phase: "Shell", name: "Tie Beam Rebars Inspection", durationDays: 1, offsetDays: 17, parentRef: "tie-beam", isMilestone: true, predecessorRefs: ["tb-rebars"] },
      { localId: "tb-pour", phase: "Shell", name: "Tie Beam Pouring Concrete", durationDays: 1, offsetDays: 18, parentRef: "tie-beam", trade: "Concrete", predecessorRefs: ["tb-insp"] },

      // Trusses (WBS 1.1.6) — truss-inst predecessor is tb-insp (not tb-pour per v2)
      { localId: "trusses", phase: "Shell", name: "Trusses", durationDays: 15, offsetDays: 18, parentRef: "shell" },
      { localId: "truss-inst", phase: "Shell", name: "Trusses installation", durationDays: 10, offsetDays: 18, parentRef: "trusses", trade: "Framing", predecessorRefs: ["tb-insp"] },
      { localId: "plywood", phase: "Shell", name: "Plywood Sheathing", durationDays: 5, offsetDays: 28, parentRef: "trusses", trade: "Framing", predecessorRefs: ["truss-inst"] },

      // ── PLUMBING (WBS 1.2) ────────────────────────────────────────────────────
      { localId: "plumbing", phase: "Plumbing", name: "Plumbing", durationDays: 82, offsetDays: 12, parentRef: "root" },

      // Plumbing Underground (WBS 1.2.1)
      { localId: "plumb-ug", phase: "Plumbing", name: "Plumbing Underground", durationDays: 5, offsetDays: 12, parentRef: "plumbing" },
      { localId: "plumb-ug-inst", phase: "Plumbing", name: "Plumbing Underground Installation", durationDays: 4, offsetDays: 12, parentRef: "plumb-ug", trade: "Plumbing", predecessorRefs: ["lift-blk"] },
      { localId: "plumb-ug-insp", phase: "Plumbing", name: "Plumbing Underground Inspection", durationDays: 1, offsetDays: 16, parentRef: "plumb-ug", isMilestone: true, predecessorRefs: ["plumb-ug-inst"] },

      // SOG children — sog-rebars depends on plumb-ug-insp (cross-phase)
      { localId: "sog-rebars", phase: "Shell", name: "SOG Rebars Installation", durationDays: 4, offsetDays: 17, parentRef: "sog", trade: "Concrete", predecessorRefs: ["plumb-ug-insp"] },
      { localId: "sog-insp", phase: "Shell", name: "SOG Inspection", durationDays: 1, offsetDays: 21, parentRef: "sog", isMilestone: true, predecessorRefs: ["sog-rebars"] },
      { localId: "sog-pour", phase: "Shell", name: "SOG Pouring Concrete", durationDays: 1, offsetDays: 22, parentRef: "sog", trade: "Concrete", predecessorRefs: ["sog-insp"] },

      // Plumbing Rough (WBS 1.2.2)
      { localId: "plumb-rough-sect", phase: "Plumbing", name: "Plumbing Rough", durationDays: 2, offsetDays: 44, parentRef: "plumbing" },
      { localId: "plumb-rough", phase: "Plumbing", name: "Plumbing Rough Installation", durationDays: 1, offsetDays: 44, parentRef: "plumb-rough-sect", trade: "Plumbing" },
      { localId: "plumb-rough-insp", phase: "Plumbing", name: "Plumbing Rough Inspection", durationDays: 1, offsetDays: 45, parentRef: "plumb-rough-sect", isMilestone: true },

      // ── ELECTRICAL (WBS 1.3) ─────────────────────────────────────────────────
      { localId: "elec", phase: "Electrical", name: "Electrical", durationDays: 78, offsetDays: 6, parentRef: "root" },
      { localId: "elec-ug", phase: "Electrical", name: "Electrical Underground", durationDays: 1, offsetDays: 6, parentRef: "elec", trade: "Electrical", predecessorRefs: ["foot-rebars"] },

      // ── ROOF (WBS 1.4) ────────────────────────────────────────────────────────
      { localId: "roof", phase: "Roof", name: "Roof", durationDays: 6, offsetDays: 33, parentRef: "root" },
      { localId: "roof-inst", phase: "Roof", name: "Flat Roof Installation", durationDays: 5, offsetDays: 33, parentRef: "roof", trade: "Roofing", predecessorRefs: ["plywood"] },
      { localId: "roof-insp", phase: "Roof", name: "Flat Roof Final Inspection", durationDays: 1, offsetDays: 38, parentRef: "roof", isMilestone: true, predecessorRefs: ["roof-inst"] },

      // ── WINDOWS (WBS 1.5) ─────────────────────────────────────────────────────
      { localId: "windows", phase: "Windows", name: "Windows Installation", durationDays: 4, offsetDays: 39, parentRef: "root" },
      { localId: "win-inst", phase: "Windows", name: "Windows Installation", durationDays: 3, offsetDays: 39, parentRef: "windows", trade: "Windows", predecessorRefs: ["roof-insp"] },
      { localId: "win-insp", phase: "Windows", name: "Windows Inspection", durationDays: 1, offsetDays: 42, parentRef: "windows", isMilestone: true, predecessorRefs: ["win-inst"] },

      // ── DRYWALL (WBS 1.6) ─────────────────────────────────────────────────────
      { localId: "drywall", phase: "Drywall", name: "Drywall", durationDays: 40, offsetDays: 39, parentRef: "root" },

      // Framing (WBS 1.6.2) — framing-inst depends on roof-insp
      { localId: "framing", phase: "Drywall", name: "Framing", durationDays: 6, offsetDays: 39, parentRef: "drywall" },
      { localId: "framing-inst", phase: "Drywall", name: "Framing Installation", durationDays: 5, offsetDays: 39, parentRef: "framing", trade: "Framing", predecessorRefs: ["roof-insp"] },
      { localId: "framing-insp", phase: "Drywall", name: "Framing Inspection", durationDays: 1, offsetDays: 44, parentRef: "framing", isMilestone: true, predecessorRefs: ["framing-inst"] },

      // Insulation (WBS 1.6.1) — wall-insul depends on framing-insp
      { localId: "insulation", phase: "Drywall", name: "Insulation", durationDays: 9, offsetDays: 45, parentRef: "drywall" },
      { localId: "wall-insul", phase: "Drywall", name: "Wall Insulation", durationDays: 3, offsetDays: 45, parentRef: "insulation", trade: "Insulation", predecessorRefs: ["framing-insp"] },
      { localId: "roof-insul", phase: "Drywall", name: "Roof Insulation", durationDays: 4, offsetDays: 48, parentRef: "insulation", trade: "Insulation", predecessorRefs: ["wall-insul"] },
      { localId: "insul-insp", phase: "Drywall", name: "Insulation Inspection", durationDays: 1, offsetDays: 52, parentRef: "insulation", isMilestone: true, predecessorRefs: ["roof-insul", "wall-insul"] },

      // ── HVAC (WBS 1.11) — hvac-ducts depends on framing-insp ──────────────────
      { localId: "hvac", phase: "HVAC", name: "HVAC", durationDays: 5, offsetDays: 45, parentRef: "root" },
      { localId: "hvac-ducts", phase: "HVAC", name: "HVAC Ducts Installation", durationDays: 3, offsetDays: 45, parentRef: "hvac", trade: "HVAC", predecessorRefs: ["framing-insp"] },
      { localId: "hvac-rough-insp", phase: "HVAC", name: "HVAC Rough Inspection", durationDays: 1, offsetDays: 48, parentRef: "hvac", isMilestone: true, predecessorRefs: ["hvac-ducts"] },

      // Electrical Rough — depends on framing-insp (v2 change)
      { localId: "elec-rough", phase: "Electrical", name: "Electrical Rough", durationDays: 5, offsetDays: 45, parentRef: "elec", trade: "Electrical", predecessorRefs: ["framing-insp"] },
      { localId: "elec-rough-insp", phase: "Electrical", name: "Electrical Rough Inspection", durationDays: 1, offsetDays: 50, parentRef: "elec", isMilestone: true, predecessorRefs: ["elec-rough"] },

      // Drywall Hanging (WBS 1.6.3) — depends on HVAC, insulation, electrical, plumbing rough inspections
      { localId: "dw-hang-sect", phase: "Drywall", name: "Drywall Hanging", durationDays: 11, offsetDays: 53, parentRef: "drywall" },
      { localId: "dw-hang", phase: "Drywall", name: "Drywall Hanging", durationDays: 10, offsetDays: 53, parentRef: "dw-hang-sect", trade: "Drywall", predecessorRefs: ["hvac-rough-insp", "insul-insp", "elec-rough-insp", "plumb-rough-insp"] },
      { localId: "dw-insp", phase: "Drywall", name: "Drywall Inspection", durationDays: 1, offsetDays: 63, parentRef: "dw-hang-sect", isMilestone: true, predecessorRefs: ["dw-hang"] },

      // Drywall Finish (WBS 1.6.4)
      { localId: "dw-finish-sect", phase: "Drywall", name: "Drywall Finish", durationDays: 8, offsetDays: 64, parentRef: "drywall" },
      { localId: "dw-finish", phase: "Drywall", name: "Drywall Finish", durationDays: 7, offsetDays: 64, parentRef: "dw-finish-sect", trade: "Drywall", predecessorRefs: ["dw-insp"] },
      { localId: "dw-touch", phase: "Drywall", name: "Drywall Finishes Touch Ups", durationDays: 1, offsetDays: 71, parentRef: "dw-finish-sect", trade: "Drywall", predecessorRefs: ["dw-finish"] },

      // Interior Painting (WBS 1.6.8)
      { localId: "painting", phase: "Drywall", name: "Interior Painting", durationDays: 10, offsetDays: 72, parentRef: "drywall" },
      { localId: "ceil-paint", phase: "Drywall", name: "Ceilings Paint", durationDays: 3, offsetDays: 72, parentRef: "painting", trade: "Painter", predecessorRefs: ["dw-touch"] },
      { localId: "wall-paint", phase: "Drywall", name: "Wall Paint", durationDays: 7, offsetDays: 75, parentRef: "painting", trade: "Painter", predecessorRefs: ["ceil-paint"] },

      // ── TILES (WBS 1.7) ───────────────────────────────────────────────────────
      { localId: "tiles", phase: "Tiles", name: "Tiles", durationDays: 12, offsetDays: 82, parentRef: "root" },
      { localId: "floor-tiles", phase: "Tiles", name: "Flooring Tiles", durationDays: 7, offsetDays: 82, parentRef: "tiles", trade: "Tile", predecessorRefs: ["wall-paint"] },
      { localId: "bath-tiles", phase: "Tiles", name: "Bathroom Wall Tiles", durationDays: 5, offsetDays: 64, parentRef: "tiles", trade: "Tile", predecessorRefs: ["dw-insp"] },

      // ── FINE CARPENTRY (WBS 1.8) ──────────────────────────────────────────────
      { localId: "carpentry", phase: "Fine Carpentry", name: "Fine Carpentry", durationDays: 13, offsetDays: 89, parentRef: "root" },
      { localId: "doors", phase: "Fine Carpentry", name: "Doors Installation", durationDays: 3, offsetDays: 89, parentRef: "carpentry", trade: "Carpenter", predecessorRefs: ["floor-tiles"] },
      { localId: "baseboards", phase: "Fine Carpentry", name: "Baseboards Installation", durationDays: 10, offsetDays: 92, parentRef: "carpentry", trade: "Carpenter", predecessorRefs: ["doors"] },
      { localId: "door-casings", phase: "Fine Carpentry", name: "Doors Casings Installation", durationDays: 5, offsetDays: 92, parentRef: "carpentry", trade: "Carpenter", predecessorRefs: ["doors"] },

      // ── STUCCO & EXTERIOR PAINT (WBS 1.9 / 1.10) — no linked from/to in v2 ───
      { localId: "stucco", phase: "Exterior", name: "Stucco", durationDays: 60, offsetDays: 33, parentRef: "root", trade: "Stucco" },
      { localId: "ext-paint", phase: "Exterior", name: "Exterior Paint", durationDays: 60, offsetDays: 93, parentRef: "root", trade: "Painter" },

      // Electrical Trims — depends on ceil-paint and wall-paint (v2 change)
      { localId: "elec-trims", phase: "Electrical", name: "Electrical Trims and outlets", durationDays: 4, offsetDays: 82, parentRef: "elec", trade: "Electrical", predecessorRefs: ["ceil-paint", "wall-paint"] },
      { localId: "elec-final", phase: "Electrical", name: "Electrical Final Inspection", durationDays: 1, offsetDays: 86, parentRef: "elec", isMilestone: true, predecessorRefs: ["elec-trims"] },

      // Plumbing Trims (WBS 1.2.3) — in v2, plumb-tub deps framing-insp, plumb-vanity deps wall-paint, plumb-toilets deps floor-tiles
      { localId: "plumb-trims", phase: "Plumbing", name: "Plumbing Trims", durationDays: 3, offsetDays: 82, parentRef: "plumbing" },
      { localId: "plumb-toilets", phase: "Plumbing", name: "Toilets Installation", durationDays: 1, offsetDays: 89, parentRef: "plumb-trims", trade: "Plumbing", predecessorRefs: ["floor-tiles"] },
      { localId: "plumb-vanity", phase: "Plumbing", name: "Vanity Installation", durationDays: 1, offsetDays: 82, parentRef: "plumb-trims", trade: "Plumbing", predecessorRefs: ["wall-paint"] },
      { localId: "plumb-tub", phase: "Plumbing", name: "Bathtub Installation", durationDays: 1, offsetDays: 45, parentRef: "plumb-trims", trade: "Plumbing", predecessorRefs: ["framing-insp"] },

      // Plumbing Final Inspection (WBS 1.2.4) — depends on bathtub (not toilets/vanity per v2)
      { localId: "plumb-final", phase: "Plumbing", name: "Plumbing Final Inspection", durationDays: 1, offsetDays: 46, parentRef: "plumbing", isMilestone: true, predecessorRefs: ["plumb-tub"] },

      // HVAC Trims — hvac-split depends on wall-paint (v2 change)
      { localId: "hvac-split", phase: "HVAC", name: "HVAC Mini Split Installation", durationDays: 1, offsetDays: 82, parentRef: "hvac", trade: "HVAC", predecessorRefs: ["wall-paint"] },
      { localId: "hvac-final", phase: "HVAC", name: "HVAC Final Inspection", durationDays: 1, offsetDays: 83, parentRef: "hvac", isMilestone: true, predecessorRefs: ["hvac-split"] },

      // ── CLOSEOUT (WBS 1.12 / 1.13) — no linked from/to in v2 ──────────────────
      { localId: "final-clean", phase: "Closeout", name: "Final Cleaning", durationDays: 1, offsetDays: 99, parentRef: "root" },
      { localId: "bldg-final-insp", phase: "Closeout", name: "Building Final Inspection", durationDays: 1, offsetDays: 100, parentRef: "root", isMilestone: true },
    ],
  },
];

// ── Save Schedule Modal ────────────────────────────────────────────────────────

function SaveScheduleModal({
  companyId,
  tasks,
  existingId,
  existingName,
  onClose,
  onSaved,
}: {
  companyId: string;
  tasks: ClientTask[];
  existingId?: string;
  existingName?: string;
  onClose: () => void;
  onSaved: (id: string, name: string) => void;
}) {
  const [mode, setMode] = useState<"overwrite" | "new">(existingId ? "overwrite" : "overwrite");
  const [name, setName] = useState(existingName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string }[]>([]);
  const [overwriteId, setOverwriteId] = useState<string>(existingId ?? "");
  const [overwriteName, setOverwriteName] = useState<string>(existingName ?? "");

  useEffect(() => {
    fetch(`/api/${companyId}/schedule-templates`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSavedTemplates(data); })
      .catch(() => {});
  }, [companyId]);

  const taskPayload = tasks.map(t => ({
    phase: t.phase, name: t.name, durationDays: t.durationDays, offsetDays: 0,
    trade: t.trade, assignee: t.assignee, isMilestone: t.isMilestone,
    parentId: t.parentId, predecessorIds: t.predecessorIds, sortOrder: t.sortOrder, notes: t.notes,
  }));

  async function handleSave() {
    setSaving(true); setError("");
    try {
      let res: Response;
      if (mode === "overwrite" && overwriteId) {
        res = await fetch(`/api/${companyId}/schedule-templates/${overwriteId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: overwriteName, tasks: taskPayload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        onSaved(data.id, overwriteName);
      } else {
        if (!name.trim()) { setError("Name is required"); setSaving(false); return; }
        res = await fetch(`/api/${companyId}/schedule-templates`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), tasks: taskPayload }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to save");
        onSaved(data.id, name.trim());
      }
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const canSave = mode === "overwrite" ? !!overwriteId : !!name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#161b22", border: "1px solid #30373f" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base" style={{ color: "#C9A84C" }}>Save Template</h3>
          <button onClick={onClose} style={{ color: "#888" }} className="text-xl leading-none">✕</button>
        </div>

        <p className="text-xs" style={{ color: "#8b949e" }}>{taskPayload.length} tasks will be saved as a reusable template.</p>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <button onClick={() => setMode("overwrite")} className="flex-1 text-xs font-semibold py-2"
            style={{ background: mode === "overwrite" ? "#C9A84C" : "#1e2736", color: mode === "overwrite" ? "#0d1117" : "#8b949e" }}>
            Overwrite existing
          </button>
          <button onClick={() => setMode("new")} className="flex-1 text-xs font-semibold py-2"
            style={{ background: mode === "new" ? "#C9A84C" : "#1e2736", color: mode === "new" ? "#0d1117" : "#8b949e", borderLeft: "1px solid #30373f" }}>
            Save as new
          </button>
        </div>

        {mode === "overwrite" ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs" style={{ color: "#8b949e" }}>Choose template to overwrite</label>
            {savedTemplates.length === 0 ? (
              <p className="text-xs italic" style={{ color: "#484f58" }}>No saved templates yet — use &ldquo;Save as new&rdquo; first.</p>
            ) : (
              <select
                value={overwriteId}
                onChange={e => {
                  const t = savedTemplates.find(t => t.id === e.target.value);
                  if (t) { setOverwriteId(t.id); setOverwriteName(t.name); }
                }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3", colorScheme: "dark" }}
              >
                <option value="">— Select a template —</option>
                {savedTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs mb-1 block" style={{ color: "#8b949e" }}>New template name *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Addition v3, Roof Replacement…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "#0d1117", border: "1px solid #30373f", color: "#e6edf3" }} />
          </div>
        )}

        {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 text-xs font-semibold rounded-lg" style={{ background: "#1e2736", color: "#888" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !canSave} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-40"
            style={{ background: "#C9A84C", color: "#0d1117" }}>
            {saving ? "Saving…" : mode === "overwrite" ? `Overwrite "${overwriteName}"` : "Save as New"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Load Template Modal ────────────────────────────────────────────────────────

type SavedTplMeta = { id: string; name: string; description?: string | null; updatedAt: string };

function LoadTemplateModal({
  companyId,
  clientId,
  onLoaded,
  onClose,
}: {
  companyId: string;
  clientId: string;
  onLoaded: (tasks: ClientTask[], templateId?: string, templateName?: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ScheduleTemplate | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<SavedTplMeta | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedTplMeta[]>([]);
  const [startDate, setStartDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    fetch(`/api/${companyId}/schedule-templates`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setSavedTemplates(data); })
      .catch(() => {});
  }, [companyId]);

  async function handleLoad() {
    if (!selected && !selectedSaved) return;
    setLoading(true);
    const base = parseDate(startDate) ?? new Date();

    // For saved templates, fetch the full tasks JSON first
    let tasksToLoad: TplTask[] = [];
    if (selected) {
      tasksToLoad = selected.tasks;
    } else if (selectedSaved) {
      const r = await fetch(`/api/${companyId}/schedule-templates/${selectedSaved.id}`);
      const data = await r.json();
      // Saved tasks use parentId/predecessorIds directly — adapt to TplTask format
      // We create a temp localId map using index
      const rawTasks = (data.tasks ?? []) as Array<Record<string, unknown>>;
      tasksToLoad = rawTasks.map((t, i) => ({
        localId: `idx_${i}`,
        phase: String(t.phase ?? "General"),
        name: String(t.name ?? "Task"),
        durationDays: Number(t.durationDays ?? 1),
        offsetDays: 0,
        trade: t.trade ? String(t.trade) : undefined,
        assignee: t.assignee ? String(t.assignee) : undefined,
        isMilestone: Boolean(t.isMilestone),
        notes: t.notes ? String(t.notes) : undefined,
        sortOrder: Number(t.sortOrder ?? i),
      }));
    }

    const localIdMap = new Map<string, string>();
    const created: ClientTask[] = [];
    let sortIdx = 0;
    for (const t of tasksToLoad) {
      const start = addDays(base, t.offsetDays ?? 0);
      const end = addDays(start, t.durationDays - 1);
      const parentId = t.parentRef ? (localIdMap.get(t.parentRef) ?? null) : null;
      const predecessorIds = (t.predecessorRefs ?? []).map(ref => localIdMap.get(ref)).filter(Boolean) as string[];
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: t.phase, name: t.name, durationDays: t.durationDays,
          startDate: toDateStr(start), endDate: toDateStr(end),
          trade: t.trade ?? null, isMilestone: t.isMilestone ?? false,
          parentId, predecessorIds, sortOrder: sortIdx++,
        }),
      });
      const raw = await res.json();
      if (t.localId) localIdMap.set(t.localId, raw.id);
      created.push({
        id: raw.id, phase: raw.phase ?? t.phase, name: raw.name ?? t.name,
        durationDays: raw.durationDays ?? t.durationDays,
        startDate: raw.startDate ?? null, endDate: raw.endDate ?? null,
        predecessorIds: raw.predecessorIds ?? predecessorIds,
        parentId: raw.parentId ?? parentId,
        trade: raw.trade ?? t.trade ?? null, assignee: raw.assignee ?? null,
        isMilestone: raw.isMilestone ?? t.isMilestone ?? false,
        status: raw.status ?? "NOT_STARTED", percentComplete: raw.percentComplete ?? 0,
        notes: raw.notes ?? null, priority: raw.priority ?? null,
        actualFinish: raw.actualFinish ?? null, sortOrder: raw.sortOrder ?? 0,
      });
    }
    setLoading(false);
    onLoaded(created, selectedSaved?.id, selectedSaved?.name);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this saved template?")) return;
    setDeleting(id);
    await fetch(`/api/${companyId}/schedule-templates/${id}`, { method: "DELETE" });
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedSaved?.id === id) setSelectedSaved(null);
    setDeleting(null);
  }

  async function handleRename(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const tpl = savedTemplates.find(t => t.id === id);
    if (!tpl) return;
    setRenamingId(id);
    setRenameValue(tpl.name);
  }

  async function commitRename(id: string) {
    if (!renameValue.trim()) return;
    await fetch(`/api/${companyId}/schedule-templates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    });
    setSavedTemplates(prev => prev.map(t => t.id === id ? { ...t, name: renameValue.trim() } : t));
    if (selectedSaved?.id === id) setSelectedSaved(prev => prev ? { ...prev, name: renameValue.trim() } : prev);
    setRenamingId(null);
  }

  async function handleDuplicate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const r = await fetch(`/api/${companyId}/schedule-templates/${id}`);
    const data = await r.json();
    const tpl = savedTemplates.find(t => t.id === id);
    const res = await fetch(`/api/${companyId}/schedule-templates`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${tpl?.name ?? "Template"} (copy)`, tasks: data.tasks }),
    });
    const created = await res.json();
    if (created.id) setSavedTemplates(prev => [...prev, { id: created.id, name: created.name, description: created.description, updatedAt: created.updatedAt }]);
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold" style={{ color: "#e6edf3" }}>Load Schedule Template</h3>
          <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
        </div>

        {/* Built-in templates */}
        <p className="text-xs font-semibold mb-2" style={{ color: "#8b949e" }}>Built-in Templates</p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SCHEDULE_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => { setSelected(tpl); setSelectedSaved(null); }}
              className="text-left p-3 rounded-xl transition-all"
              style={{
                background: selected?.id === tpl.id ? "#1e2736" : "#0d1117",
                border: `1px solid ${selected?.id === tpl.id ? GOLD : "#30373f"}`,
              }}>
              <div className="text-xl mb-1">{tpl.emoji}</div>
              <div className="text-sm font-semibold" style={{ color: selected?.id === tpl.id ? GOLD : "#e6edf3" }}>{tpl.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "#8b949e" }}>{tpl.description}</div>
              <div className="text-[10px] mt-1" style={{ color: "#484f58" }}>{tpl.tasks.length} tasks · {new Set(tpl.tasks.map(t => t.phase)).size} phases</div>
            </button>
          ))}
        </div>

        {/* Saved templates */}
        {savedTemplates.length > 0 && (
          <>
            <p className="text-xs font-semibold mb-2" style={{ color: "#8b949e" }}>Saved Templates</p>
            <div className="flex flex-col gap-2 mb-5">
              {savedTemplates.map(tpl => (
                <div key={tpl.id} onClick={() => { setSelectedSaved(tpl); setSelected(null); }}
                  className="p-3 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer"
                  style={{ background: selectedSaved?.id === tpl.id ? "#1e2736" : "#0d1117", border: `1px solid ${selectedSaved?.id === tpl.id ? GOLD : "#30373f"}` }}>
                  <div className="flex-1 min-w-0">
                    {renamingId === tpl.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") commitRename(tpl.id); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => commitRename(tpl.id)}
                        onClick={e => e.stopPropagation()}
                        className="w-full rounded px-2 py-0.5 text-sm outline-none"
                        style={{ background: "#161b22", border: "1px solid #C9A84C", color: "#e6edf3" }}
                      />
                    ) : (
                      <>
                        <div className="text-sm font-semibold truncate" style={{ color: selectedSaved?.id === tpl.id ? GOLD : "#e6edf3" }}>📁 {tpl.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "#484f58" }}>
                          Saved {new Date(tpl.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={e => handleRename(tpl.id, e)} title="Rename" className="w-7 h-7 flex items-center justify-center rounded"
                      style={{ background: "#1e2736", color: "#8b949e", fontSize: 13 }}>✏️</button>
                    <button onClick={e => handleDuplicate(tpl.id, e)} title="Duplicate" className="w-7 h-7 flex items-center justify-center rounded"
                      style={{ background: "#1e2736", color: "#8b949e", fontSize: 13 }}>⧉</button>
                    <button onClick={e => handleDelete(tpl.id, e)} disabled={deleting === tpl.id} title="Delete" className="w-7 h-7 flex items-center justify-center rounded"
                      style={{ background: "#2d1a1a", color: "#f87171", fontSize: 13 }}>
                      {deleting === tpl.id ? "…" : "🗑"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(selected || selectedSaved) && (
          <>
            {selected && (
              <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
                <div className="font-semibold mb-2" style={{ color: "#8b949e" }}>Phases: {Array.from(new Set(selected.tasks.map(t => t.phase))).join(" → ")}</div>
                <div className="flex flex-wrap gap-1">
                  {selected.tasks.filter(t => t.isMilestone).map(t => (
                    <span key={t.name} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: "#1e2736", color: "#7c3aed", border: "1px solid #7c3aed44" }}>◆ {t.name}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Project Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ ...INPUT, width: 180 }} />
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button onClick={handleLoad} disabled={(!selected && !selectedSaved) || loading}
            className="flex-1 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {loading ? "Loading…" : `Load ${selected?.label ?? selectedSaved?.name ?? "Template"}`}
          </button>
          <button onClick={onClose} className="px-5 py-2 text-sm rounded-xl" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  task, allTasks, companyId, clientId, onSave, onDelete, onClose,
}: {
  task: ClientTask; allTasks: ClientTask[]; companyId: string; clientId: string;
  onSave: (updated: ClientTask) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: task.name, phase: task.phase,
    durationDays: String(task.durationDays),
    startDate: task.startDate ?? "", endDate: task.endDate ?? "",
    trade: task.trade ?? "", assignee: task.assignee ?? "",
    status: task.status, percentComplete: String(task.percentComplete),
    isMilestone: task.isMilestone, parentId: task.parentId ?? "",
    predecessorIds: task.predecessorIds, notes: task.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const parent = allTasks.find(t => t.id === form.parentId);
  const children = allTasks.filter(t => t.parentId === task.id);

  function togglePredecessor(id: string) {
    setForm(f => ({ ...f, predecessorIds: f.predecessorIds.includes(id) ? f.predecessorIds.filter(p => p !== id) : [...f.predecessorIds, id] }));
  }

  async function handleSave() {
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const body = {
      name: form.name.trim(), phase: form.phase.trim() || "General",
      durationDays: dur, startDate: form.startDate || null, endDate: form.endDate || null,
      trade: form.trade.trim() || null, assignee: form.assignee.trim() || null,
      status: form.status, percentComplete: Math.min(100, Math.max(0, parseInt(form.percentComplete) || 0)),
      isMilestone: form.isMilestone, parentId: form.parentId || null,
      predecessorIds: form.predecessorIds, notes: form.notes.trim() || null,
    };
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const updated = await res.json();
      onSave({ ...task, ...updated });
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
  }

  const otherTasks = allTasks.filter(t => t.id !== task.id);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Edit Task</h3>
          <div className="flex gap-2">
            {confirmDelete ? (
              <>
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete?</span>
                <button onClick={handleDelete} className="text-xs px-2 py-1 rounded font-bold" style={{ background: "#f8514922", color: "#f85149" }}>Yes</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#2d1b1b", color: "#f87171" }}>Delete</button>
            )}
            <button onClick={onClose} className="text-lg leading-none" style={{ color: "#8b949e" }}>×</button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} className="outline-none" placeholder="General" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Framing" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Crew A" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>% Complete</label>
              <input type="number" min="0" max="100" value={form.percentComplete} onChange={e => setForm(f => ({ ...f, percentComplete: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Parent Task</label>
            <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
              <option value="">— None —</option>
              {otherTasks.map(t => <option key={t.id} value={t.id}>{t.phase} / {t.name}</option>)}
            </select>
            {parent && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Parent: <strong style={{ color: GOLD }}>{parent.phase} / {parent.name}</strong>
              </div>
            )}
            {children.length > 0 && (
              <div className="mt-1 text-[10px] px-2 py-1 rounded" style={{ background: "#1e2736", color: "#8b949e" }}>
                Sub-tasks: {children.map(c => <strong key={c.id} style={{ color: "#94a3b8" }}> {c.name}</strong>)}
              </div>
            )}
          </div>

          {otherTasks.length > 0 && (
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Linked From — tasks that must finish before this one can start</label>
              <div className="flex flex-wrap gap-1.5">
                {otherTasks.map(t => {
                  const sel = form.predecessorIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => togglePredecessor(t.id)} className="text-[10px] px-2 py-1 rounded font-medium"
                      style={{ background: sel ? "#C9A84C22" : "#1e2736", border: `1px solid ${sel ? GOLD : "#30373f"}`, color: sel ? GOLD : "#8b949e" }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs" style={{ color: "#8b949e" }}>
            <input type="checkbox" checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} />
            Milestone
          </label>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...INPUT, resize: "none" }} className="outline-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal ─────────────────────────────────────────────────────────────

function AddTaskModal({ companyId, clientId, phases, onCreate, onClose, defaultParentId, defaultParentName, defaultMode }: {
  companyId: string; clientId: string; phases: string[];
  onCreate: (task: ClientTask) => void; onClose: () => void;
  defaultParentId?: string; defaultParentName?: string;
  defaultMode?: "task" | "phase";
}) {
  const [mode, setMode] = useState<"task" | "phase">(defaultMode ?? "task");
  const [form, setForm] = useState({ name: "", phase: phases[0] ?? "General", durationDays: "5", startDate: todayStr(), trade: "", assignee: "" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const dur = mode === "phase" ? 1 : Math.max(1, parseInt(form.durationDays) || 1);
    const start = form.startDate ? new Date(form.startDate + "T00:00:00") : new Date();
    const end = addDays(start, dur - 1);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phase: mode === "phase" ? form.name.trim() : (form.phase.trim() || "General"),
          durationDays: dur,
          startDate: toDateStr(start),
          endDate: toDateStr(end),
          trade: mode === "phase" ? null : (form.trade.trim() || null),
          assignee: mode === "phase" ? null : (form.assignee.trim() || null),
          parentId: mode === "phase" ? null : (defaultParentId ?? null),
        }),
      });
      const raw = await res.json();
      const task: ClientTask = {
        predecessorIds: [], parentId: null, trade: null, assignee: null,
        isMilestone: false, status: "NOT_STARTED", percentComplete: 0, notes: null,
        priority: null, actualFinish: null, sortOrder: 0,
        ...raw,
      };
      onCreate(task);
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440 }}
        onClick={e => e.stopPropagation()}>
        {/* Mode toggle */}
        <div className="flex gap-1 mb-4" style={{ background: "#0d1117", borderRadius: 8, padding: 4 }}>
          {(["task", "phase"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-1.5 text-xs font-semibold rounded-md"
              style={{ background: mode === m ? GOLD : "transparent", color: mode === m ? "#0d1117" : "#8b949e" }}>
              {m === "task" ? "📋 Task" : "📁 Phase"}
            </button>
          ))}
        </div>
        <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>
          {mode === "phase" ? "Add Phase" : (defaultParentId ? "Add Sub-task" : "Add Task")}
        </h3>
        {mode === "task" && defaultParentName && <p className="text-xs mb-4" style={{ color: "#8b949e" }}>Child of: <span style={{ color: GOLD }}>{defaultParentName}</span></p>}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>{mode === "phase" ? "Phase Name *" : "Task Name *"}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          {mode === "task" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
                <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} className="outline-none" list="phase-list" />
                <datalist id="phase-list">{phases.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
                <input type="number" min="1" value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: e.target.value }))} style={INPUT} className="outline-none" />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Start Date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} className="outline-none" />
              </div>
              <div>
                <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
                <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} className="outline-none" placeholder="Optional" />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Adding…" : (mode === "phase" ? "Add Phase" : "Add Task")}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Assign Tasks to Phase Modal ────────────────────────────────────────────────

function AssignTasksModal({ phaseTask, tasks, companyId, clientId, onAssigned, onClose }: {
  phaseTask: ClientTask; tasks: ClientTask[];
  companyId: string; clientId: string;
  onAssigned: (updated: ClientTask[]) => void;
  onClose: () => void;
}) {
  const candidates = tasks.filter(t => t.id !== phaseTask.id && !t.parentId);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.filter(t => t.phase === phaseTask.name).map(t => t.id))
  );
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected(prev => { const s = new Set(prev); if (s.has(id)) { s.delete(id); } else { s.add(id); } return s; });
  }

  async function handleAssign() {
    setSaving(true);
    if (selected.size > 0) {
      await Promise.all(Array.from(selected).map(id =>
        fetch(`/api/${companyId}/clients/${clientId}/schedule/${id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parentId: phaseTask.id }),
        })
      ));
    }
    onAssigned(tasks.map(t => selected.has(t.id) ? { ...t, parentId: phaseTask.id } : t));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 460 }}
        onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Move tasks under <span style={{ color: GOLD }}>{phaseTask.name}</span>?</h3>
        <p className="text-xs mb-3" style={{ color: "#8b949e" }}>Select tasks to nest under this phase. You can change this later.</p>
        {candidates.length === 0 ? (
          <p className="text-xs" style={{ color: "#484f58" }}>No top-level tasks to assign.</p>
        ) : (
          <div className="space-y-1" style={{ maxHeight: 280, overflowY: "auto" }}>
            {candidates.map(t => (
              <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:brightness-125"
                style={{ background: selected.has(t.id) ? "#1e2736" : "transparent", border: `1px solid ${selected.has(t.id) ? "#C9A84C44" : "transparent"}` }}>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} style={{ accentColor: GOLD }} />
                <span className="text-xs" style={{ color: "#e6edf3" }}>{t.name}</span>
                {t.startDate && <span className="text-[10px] ml-auto" style={{ color: "#484f58" }}>{t.startDate}</span>}
              </label>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={handleAssign} disabled={saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Moving…" : selected.size > 0 ? `Move ${selected.size} task${selected.size > 1 ? "s" : ""}` : "Done (no tasks selected)"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Skip</button>
        </div>
      </div>
    </div>
  );
}

// ── Gantt Chart ────────────────────────────────────────────────────────────────

function ClientGanttChart({ tasks, projectStart, companyId, clientId, canEdit, onTasksChange, collapsed, setCollapsed }: {
  tasks: ClientTask[]; projectStart: Date; companyId: string; clientId: string; canEdit: boolean; onTasksChange: (tasks: ClientTask[]) => void;
  collapsed: Set<string>; setCollapsed: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [phaseOrder, setPhaseOrder] = useState<string[]>([]);
  const [phaseDrag, setPhaseDrag] = useState<{ phase: string; startClientY: number; currentClientY: number } | null>(null);
  const phaseDragRef2 = useRef<{ phase: string; startClientY: number; currentClientY: number } | null>(null);
  phaseDragRef2.current = phaseDrag;
  const phaseOrderRef = useRef<string[]>([]);
  const rowsRef = useRef<Array<{ kind: "phase"; phase: string; y: number }>>([]);
  const [editTask, setEditTask] = useState<ClientTask | null>(null);
  const [addChildFor, setAddChildFor] = useState<ClientTask | null>(null);
  const [setParentFor, setSetParentFor] = useState<ClientTask | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: ClientTask; confirmDelete?: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [labelW, setLabelW] = useState(LABEL_WIDTH);

  // ── Label column resize ─────────────────────────────────────────────────────
  const labelResizeRef = useRef<{ startX: number; startW: number } | null>(null);
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const r = labelResizeRef.current;
      if (!r) return;
      setLabelW(Math.max(120, r.startW + e.clientX - r.startX));
    }
    function onUp() { labelResizeRef.current = null; }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  // Track last click for double-click detection
  const lastClickRef = useRef<{ time: number; taskId: string } | null>(null);

  const toggle = (phase: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(phase)) next.delete(phase); else next.add(phase);
    return next;
  });

  const phases = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
    const map = new Map<string, ClientTask[]>();
    for (const t of sorted) { const arr = map.get(t.phase) ?? []; arr.push(t); map.set(t.phase, arr); }
    return map;
  }, [tasks]);

  // Keep phaseOrder in sync: preserve user reordering, append new phases at end
  useEffect(() => {
    setPhaseOrder(prev => {
      const current = Array.from(phases.keys());
      if (prev.length === 0) return current;
      const newOnes = current.filter(p => !prev.includes(p));
      return [...prev.filter(p => phases.has(p)), ...newOnes];
    });
  }, [phases]);

  const projectEnd = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
    if (!dates.length) return addDays(projectStart, 30);
    return dates.reduce((max, d) => (d > max ? d : max), dates[0]);
  }, [tasks, projectStart]);

  const totalDays = differenceInDays(projectEnd, projectStart) + 8;
  const today = useMemo(() => new Date(), []);

  const months: { label: string; startDay: number; days: number }[] = [];
  let cursor = new Date(projectStart);
  while (cursor <= projectEnd) {
    const startDay = differenceInDays(cursor, projectStart);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const end = monthEnd < projectEnd ? monthEnd : projectEnd;
    const days = differenceInDays(end, cursor) + 1;
    months.push({ label: format(cursor, "MMM yyyy"), startDay, days });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  type Row = { kind: "phase"; phase: string; phaseTasks: ClientTask[] } | { kind: "task"; task: ClientTask; rowNum: number };
  const rows: Row[] = [];
  let rowNum = 0;
  const orderedPhases = phaseOrder.length > 0 ? phaseOrder : Array.from(phases.keys());
  for (const phase of orderedPhases) {
    const phaseTasks = phases.get(phase);
    if (!phaseTasks) continue;
    rows.push({ kind: "phase", phase, phaseTasks });
    if (!collapsed.has(phase)) {
      for (const task of phaseTasks) { rows.push({ kind: "task", task, rowNum }); rowNum++; }
    }
  }

  let yOffset = HEADER_H;
  const rowYs: number[] = [];
  for (const row of rows) { rowYs.push(yOffset); yOffset += row.kind === "phase" ? PHASE_ROW_HEIGHT : ROW_HEIGHT; }
  const svgHeight = yOffset + 30;
  const svgWidth = labelW + totalDays * CELL_WIDTH;

  // Keep refs up to date for phase drag handler
  phaseOrderRef.current = phaseOrder;
  rowsRef.current = rows.map((r, i) => r.kind === "phase" ? { kind: "phase" as const, phase: r.phase, y: rowYs[i] } : null).filter(Boolean) as Array<{ kind: "phase"; phase: string; y: number }>;

  const getSvgX = useCallback((clientX: number) => {
    if (!svgRef.current) return 0;
    return clientX - svgRef.current.getBoundingClientRect().left;
  }, []);

  // ── Drag via document-level events ──────────────────────────────────────────
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return;
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const deltaX = getSvgX(e.clientX) - d.mouseStartX;
      const deltaDays = Math.round(deltaX / CELL_WIDTH);
      setDrag(prev => prev ? { ...prev, currentDeltaDays: deltaDays } : null);
    }
    async function onUp() {
      const d = dragRef.current;
      if (!d) { setDrag(null); return; }
      if (d.currentDeltaDays === 0) { setDrag(null); return; }
      const { taskId, type, originalStart, originalEnd, currentDeltaDays } = d;
      setDrag(null);
      let newStart: Date, newEnd: Date;
      if (type === "move") { newStart = addDays(originalStart, currentDeltaDays); newEnd = addDays(originalEnd, currentDeltaDays); }
      else { newStart = originalStart; newEnd = addDays(originalEnd, currentDeltaDays); if (newEnd <= newStart) newEnd = newStart; }
      const durationDays = Math.max(1, differenceInDays(newEnd, newStart) + 1);
      setSaving(taskId);
      try {
        const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${taskId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: toDateStr(newStart), endDate: toDateStr(newEnd), durationDays }),
        });
        const updated = await res.json();
        onTasksChange(tasks.map(t => t.id === taskId ? { ...t, ...updated } : t));
      } finally { setSaving(null); }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [drag, getSvgX, companyId, clientId, tasks, onTasksChange]);

  // ── Phase drag ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!phaseDrag) return;
    function onMove(e: MouseEvent) {
      setPhaseDrag(prev => prev ? { ...prev, currentClientY: e.clientY } : null);
    }
    function onUp() {
      const d = phaseDragRef2.current;
      if (!d) { setPhaseDrag(null); return; }
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) { setPhaseDrag(null); return; }
      const currentSvgY = d.currentClientY - svgRect.top;
      const phaseRows = rowsRef.current;
      const withoutDragging = phaseRows.filter(r => r.phase !== d.phase);
      let insertBefore: string | null = null;
      for (const r of withoutDragging) {
        if (currentSvgY < r.y + PHASE_ROW_HEIGHT / 2) { insertBefore = r.phase; break; }
      }
      setPhaseOrder(prev => {
        const without = prev.filter(p => p !== d.phase);
        if (insertBefore === null) return [...without, d.phase];
        const idx = without.indexOf(insertBefore);
        return [...without.slice(0, idx), d.phase, ...without.slice(idx)];
      });
      setPhaseDrag(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [phaseDrag]);

  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: ClientTask, type: "move" | "resize") => {
    if (!canEdit || task.isMilestone) return;
    e.preventDefault();
    e.stopPropagation();
    const start = parseDate(task.startDate) ?? today;
    const end = parseDate(task.endDate) ?? addDays(start, task.durationDays - 1);
    setDrag({ taskId: task.id, type, originalStart: start, originalEnd: end, mouseStartX: getSvgX(e.clientX), currentDeltaDays: 0 });
  }, [canEdit, getSvgX, today]);

  // ── Double-click via manual timing ─────────────────────────────────────────
  const handleBarClick = useCallback((task: ClientTask) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last && last.taskId === task.id && now - last.time < 350) {
      lastClickRef.current = null;
      setEditTask(task);
    } else {
      lastClickRef.current = { time: now, taskId: task.id };
    }
  }, []);

  const handleBarContextMenu = useCallback((e: React.MouseEvent, task: ClientTask) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  }, []);

  async function handleSetParent(child: ClientTask, parentId: string | null) {
    const parentTask = parentId ? tasks.find(t => t.id === parentId) : null;
    const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${child.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: child.name, phase: child.phase, durationDays: child.durationDays, startDate: child.startDate, endDate: child.endDate, trade: child.trade, assignee: child.assignee, status: child.status, percentComplete: child.percentComplete, isMilestone: child.isMilestone, predecessorIds: child.predecessorIds, notes: child.notes, parentId }),
    });
    const saved = await res.json();
    onTasksChange(tasks.map(t => t.id === child.id ? { ...t, ...saved } : t));
    setSetParentFor(null);
    void parentTask;
  }

  async function handleDuplicate(task: ClientTask) {
    const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: task.name + " (copy)", phase: task.phase, durationDays: task.durationDays, startDate: task.startDate, endDate: task.endDate, trade: task.trade, assignee: task.assignee, isMilestone: task.isMilestone, parentId: task.parentId, notes: task.notes }),
    });
    const raw = await res.json();
    const created: ClientTask = {
      predecessorIds: [], parentId: null, trade: null, assignee: null,
      isMilestone: false, status: "NOT_STARTED", percentComplete: 0, notes: null,
      priority: null, actualFinish: null, sortOrder: 0,
      ...raw,
    };
    onTasksChange([...tasks, created]);
  }

  async function handleDeleteTask(task: ClientTask) {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "DELETE" });
    onTasksChange(tasks.filter(t => t.id !== task.id));
  }

  return (
    <>
      <div className="overflow-x-auto select-none" style={{ cursor: drag || phaseDrag ? "grabbing" : "default" }}>
        <svg ref={svgRef} width={svgWidth} height={svgHeight} style={{ display: "block" }}>
          <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="#0d1117" />
          {/* Label column header */}
          <rect x={0} y={0} width={labelW} height={HEADER_H} fill="#161b22" />
          <text x={16} y={15} fontSize={10} fill="#8b949e" fontWeight={700} letterSpacing={1}>TASK NAME</text>

          {/* Month headers */}
          {months.map(m => (
            <g key={m.label}>
              <rect x={labelW + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
              <text x={labelW + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>{m.label}</text>
            </g>
          ))}

          {/* Weekend shading */}
          {Array.from({ length: totalDays }).map((_, d) => {
            const date = addDays(projectStart, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return <rect key={d} x={labelW + d * CELL_WIDTH} y={HEADER_H} width={CELL_WIDTH} height={svgHeight - HEADER_H - 30} fill={isWeekend ? "#0a0e14" : "transparent"} />;
          })}
          {Array.from({ length: totalDays }).map((_, d) => (
            <line key={`v${d}`} x1={labelW + d * CELL_WIDTH} y1={HEADER_H} x2={labelW + d * CELL_WIDTH} y2={svgHeight - 30} stroke="#30373f" strokeWidth={0.5} />
          ))}

          {/* Today line */}
          {today >= projectStart && today <= addDays(projectEnd, 8) && (() => {
            const x = labelW + differenceInDays(today, projectStart) * CELL_WIDTH;
            return (
              <g>
                <line x1={x} y1={0} x2={x} y2={svgHeight - 30} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,3" />
                <text x={x + 3} y={13} fontSize={9} fill="#ef4444">TODAY</text>
              </g>
            );
          })()}

          {/* Rows */}
          {rows.map((row, i) => {
            const y = rowYs[i];
            if (row.kind === "phase") {
              const isCollapsed = collapsed.has(row.phase);
              const phaseDates = row.phaseTasks.flatMap(t => [parseDate(t.startDate), parseDate(t.endDate)]).filter(Boolean) as Date[];
              const isDraggingThisPhase = phaseDrag?.phase === row.phase;
              const phaseOpacity = isDraggingThisPhase ? 0.35 : 1;
              if (!phaseDates.length) return (
                <g key={row.phase} opacity={phaseOpacity}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  {canEdit && <text x={4} y={y + 17} fontSize={10} fill="#484f58" style={{ cursor: "grab" }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setPhaseDrag({ phase: row.phase, startClientY: e.clientY, currentClientY: e.clientY }); }}>⠿</text>}
                  <g onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                    <rect x={canEdit ? 16 : 0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="transparent" />
                    <text x={canEdit ? 18 : 10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                    <text x={canEdit ? 32 : 24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                    <text x={(canEdit ? 32 : 24) + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks)</text>
                  </g>
                </g>
              );
              const phaseStart = phaseDates.reduce((min, d) => d < min ? d : min, phaseDates[0]);
              const phaseEnd = phaseDates.reduce((max, d) => d > max ? d : max, phaseDates[0]);
              const barX = labelW + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
              const barW = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
              const done = row.phaseTasks.filter(t => t.status === "DONE").length;
              const pct = Math.round((done / row.phaseTasks.length) * 100);
              return (
                <g key={row.phase} opacity={phaseOpacity}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  {canEdit && <text x={4} y={y + 17} fontSize={10} fill="#484f58" style={{ cursor: "grab" }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setPhaseDrag({ phase: row.phase, startClientY: e.clientY, currentClientY: e.clientY }); }}>⠿</text>}
                  <g onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                    <rect x={canEdit ? 16 : 0} y={y} width={labelW - (canEdit ? 16 : 0)} height={PHASE_ROW_HEIGHT} fill="transparent" />
                    <text x={canEdit ? 18 : 10} y={y + 17} fontSize={10} fill="#8b949e" fontWeight={700}>{isCollapsed ? "▶" : "▼"}</text>
                    <text x={canEdit ? 32 : 24} y={y + 17} fontSize={11} fill={GOLD} fontWeight={700}>{row.phase}</text>
                    <text x={(canEdit ? 32 : 24) + row.phase.length * 7} y={y + 17} fontSize={10} fill="#484f58"> ({row.phaseTasks.length} tasks · {pct}%)</text>
                  </g>
                  <rect x={barX} y={y + 7} width={barW} height={PHASE_ROW_HEIGHT - 14} rx={3} fill="#30373f" />
                  {pct > 0 && <rect x={barX} y={y + 7} width={(barW * pct) / 100} height={PHASE_ROW_HEIGHT - 14} rx={3} fill={GOLD} opacity={0.5} />}
                </g>
              );
            }

            const { task } = row;
            const isSaving = saving === task.id;
            const isDragging = drag?.taskId === task.id;
            const deltaDays = isDragging ? drag!.currentDeltaDays : 0;
            const startDate = parseDate(task.startDate) ?? today;
            const endDate = parseDate(task.endDate) ?? addDays(startDate, task.durationDays - 1);
            const barColor = STATUS_COLORS[task.status] ?? GOLD;
            const isEven = row.rowNum % 2 === 0;
            const isChild = !!task.parentId;

            let startDay = differenceInDays(startDate, projectStart);
            let endDay = differenceInDays(endDate, projectStart);
            if (drag?.type === "move" && isDragging) { startDay += deltaDays; endDay += deltaDays; }
            if (drag?.type === "resize" && isDragging) { endDay += deltaDays; }
            const barX = labelW + startDay * CELL_WIDTH;
            const barW = Math.max((endDay - startDay + 1) * CELL_WIDTH, CELL_WIDTH);

            return (
              <g key={task.id}>
                <rect x={0} y={y} width={svgWidth} height={ROW_HEIGHT} fill={isEven ? "#0d1117" : "#0a0e14"} />
                <line x1={0} y1={y + ROW_HEIGHT} x2={svgWidth} y2={y + ROW_HEIGHT} stroke="#30373f" strokeWidth={0.3} />
                <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT / 2 + 4} fontSize={11} fill={task.status === "DONE" ? "#484f58" : "#e6edf3"}>
                  {task.name.length > 26 ? task.name.slice(0, 26) + "…" : task.name}
                </text>
                {task.trade && <text x={isChild ? 28 : 16} y={y + ROW_HEIGHT - 5} fontSize={9} fill="#484f58">{task.trade}</text>}
                <circle cx={isChild ? 20 : 8} cy={y + ROW_HEIGHT / 2} r={3} fill={barColor} />

                {task.isMilestone ? (
                  <polygon
                    points={`${barX},${y + 6} ${barX + 10},${y + ROW_HEIGHT / 2} ${barX},${y + ROW_HEIGHT - 6} ${barX - 10},${y + ROW_HEIGHT / 2}`}
                    fill="#7c3aed" opacity={isSaving ? 0.4 : 1}
                    style={{ cursor: "pointer" }}
                    onClick={() => handleBarClick(task)}
                    onContextMenu={e => handleBarContextMenu(e, task)}
                  />
                ) : (
                  <g>
                    {isDragging && drag?.type === "move" && (
                      <rect
                        x={labelW + differenceInDays(startDate, projectStart) * CELL_WIDTH}
                        y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                        fill={barColor} opacity={0.15} stroke={barColor} strokeWidth={1} strokeDasharray="4,3"
                      />
                    )}
                    <rect
                      x={barX} y={y + 9} width={barW} height={ROW_HEIGHT - 18} rx={4}
                      fill={barColor} opacity={isSaving ? 0.3 : 0.75}
                      style={{ cursor: canEdit ? "grab" : "pointer" }}
                      onMouseDown={e => handleBarMouseDown(e, task, "move")}
                      onClick={() => handleBarClick(task)}
                      onContextMenu={e => handleBarContextMenu(e, task)}
                    />
                    {task.percentComplete > 0 && (
                      <rect x={barX} y={y + 9} width={(barW * task.percentComplete) / 100} height={ROW_HEIGHT - 18} rx={4} fill={barColor} opacity={0.95} style={{ pointerEvents: "none" }} />
                    )}
                    {barW > 32 && (
                      <text x={barX + 5} y={y + ROW_HEIGHT / 2 + 4} fontSize={9} fill="#fff" opacity={0.85} style={{ pointerEvents: "none" }}>
                        {task.durationDays}d
                      </text>
                    )}
                    {canEdit && (
                      <rect
                        x={barX + barW - RESIZE_HANDLE_W} y={y + 9} width={RESIZE_HANDLE_W} height={ROW_HEIGHT - 18} rx={4}
                        fill="#fff" opacity={0.15}
                        style={{ cursor: "ew-resize" }}
                        onMouseDown={e => { e.stopPropagation(); handleBarMouseDown(e, task, "resize"); }}
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}

          {/* Phase drag: insertion indicator + ghost */}
          {phaseDrag && (() => {
            const svgRect = svgRef.current?.getBoundingClientRect();
            if (!svgRect) return null;
            const currentSvgY = phaseDrag.currentClientY - svgRect.top;
            const phaseRows = rowsRef.current;
            const withoutDragging = phaseRows.filter(r => r.phase !== phaseDrag.phase);
            let insertY: number = phaseRows[phaseRows.length - 1]?.y ?? svgHeight;
            // after the last phase row
            const lastPhaseRow = phaseRows[phaseRows.length - 1];
            if (lastPhaseRow) insertY = lastPhaseRow.y + PHASE_ROW_HEIGHT;
            for (const r of withoutDragging) {
              if (currentSvgY < r.y + PHASE_ROW_HEIGHT / 2) { insertY = r.y; break; }
            }
            const ghostY = currentSvgY - PHASE_ROW_HEIGHT / 2;
            return (
              <g>
                <line x1={0} y1={insertY} x2={svgWidth} y2={insertY} stroke="#C9A84C" strokeWidth={2} strokeDasharray="6,3" style={{ pointerEvents: "none" }} />
                <rect x={0} y={ghostY} width={LABEL_WIDTH} height={PHASE_ROW_HEIGHT} fill="#1e2736" opacity={0.9} rx={3} style={{ pointerEvents: "none" }} />
                <text x={32} y={ghostY + 17} fontSize={11} fill={GOLD} fontWeight={700} style={{ pointerEvents: "none" }}>{phaseDrag.phase}</text>
              </g>
            );
          })()}

          {/* Resize handle for label column */}
          <g style={{ cursor: "col-resize" }}
            onMouseDown={e => { e.preventDefault(); labelResizeRef.current = { startX: e.clientX, startW: labelW }; }}>
            <rect x={labelW - 2} y={0} width={6} height={svgHeight - 30} fill="transparent" />
            <line x1={labelW} y1={0} x2={labelW} y2={svgHeight - 30} stroke="#C9A84C44" strokeWidth={2} />
          </g>

          {/* Legend */}
          <g transform={`translate(${labelW + 8}, ${svgHeight - 16})`}>
            {[
              { color: GOLD, label: "Not Started" }, { color: "#3b82f6", label: "In Progress" },
              { color: "#22c55e", label: "Done" }, { color: "#f97316", label: "Blocked" }, { color: "#7c3aed", label: "Milestone" },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(${i * 105}, 0)`}>
                <rect x={0} y={-8} width={10} height={10} fill={item.color} rx={2} />
                <text x={13} y={0} fontSize={10} fill="#484f58">{item.label}</text>
              </g>
            ))}
          </g>
        </svg>
        {canEdit && (
          <p className="text-xs mt-1" style={{ color: "#484f58" }}>
            Drag bars to move · Drag right edge to resize · Double-click to edit · Drag ⠿ on phase header to reorder
          </p>
        )}
      </div>

      {editTask && (
        <EditModal
          task={editTask} allTasks={tasks} companyId={companyId} clientId={clientId}
          onSave={updated => { onTasksChange(tasks.map(t => t.id === updated.id ? updated : t)); setEditTask(null); }}
          onDelete={id => { onTasksChange(tasks.filter(t => t.id !== id)); setEditTask(null); }}
          onClose={() => setEditTask(null)}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (() => {
        const menuW = 200;
        const menuH = contextMenu.confirmDelete ? 360 : (contextMenu.task.parentId ? 290 : 255);
        const top = contextMenu.y + menuH > window.innerHeight - 8 ? Math.max(8, contextMenu.y - menuH) : contextMenu.y;
        const left = contextMenu.x + menuW > window.innerWidth - 8 ? contextMenu.x - menuW : contextMenu.x;
        return (
        <div
          style={{ position: "fixed", top, left, zIndex: 200, minWidth: menuW, background: "#161b22", border: "1px solid #30373f", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {/* Close on outside click */}
          <div style={{ position: "fixed", inset: 0, zIndex: -1 }} onClick={() => setContextMenu(null)} />
          {[
            { label: "✏️  Edit task", action: () => { setEditTask(contextMenu.task); setContextMenu(null); } },
            { label: "➕  Add sub-task", action: () => { setAddChildFor(contextMenu.task); setContextMenu(null); } },
            { label: "📂  Nest under…", action: () => { setSetParentFor(contextMenu.task); setContextMenu(null); } },
            ...(contextMenu.task.parentId ? [{ label: "🔓  Remove parent", action: () => { handleSetParent(contextMenu.task, null); setContextMenu(null); } }] : []),
            { label: "⧉  Duplicate", action: () => { handleDuplicate(contextMenu.task); setContextMenu(null); } },
            { label: "🗑  Delete", action: () => { setContextMenu(m => m ? { ...m, confirmDelete: true } : null); }, danger: true },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#1e2736]"
              style={{ color: (item as { danger?: boolean }).danger ? "#f87171" : "#e6edf3", borderTop: i === 0 ? "none" : "1px solid #21262d" }}
            >
              {item.label}
            </button>
          ))}
          {contextMenu.confirmDelete && (
            <div style={{ borderTop: "1px solid #30373f", padding: "10px 12px", background: "#1a0f0f" }}>
              <p className="text-xs mb-2" style={{ color: "#f87171" }}>Delete &ldquo;{contextMenu.task.name}&rdquo;?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { handleDeleteTask(contextMenu.task); setContextMenu(null); }}
                  className="flex-1 text-xs font-semibold py-1 rounded"
                  style={{ background: "#f8514922", color: "#f87171", border: "1px solid #f8514944" }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setContextMenu(m => m ? { ...m, confirmDelete: false } : null)}
                  className="flex-1 text-xs py-1 rounded"
                  style={{ background: "#21262d", color: "#8b949e", border: "1px solid #30373f" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Add child task modal */}
      {addChildFor && (
        <AddTaskModal
          companyId={companyId} clientId={clientId}
          phases={Array.from(new Set(tasks.map(t => t.phase)))}
          defaultParentId={addChildFor.id}
          defaultParentName={addChildFor.name}
          onCreate={task => { onTasksChange([...tasks, task]); setAddChildFor(null); }}
          onClose={() => setAddChildFor(null)}
        />
      )}

      {/* Set parent modal */}
      {setParentFor && (() => {
        // collect all descendants of setParentFor to exclude (prevent circular)
        const excluded = new Set<string>([setParentFor.id]);
        const queue = [setParentFor.id];
        while (queue.length > 0) {
          const cur = queue.pop()!;
          tasks.filter(t => t.parentId === cur).forEach(t => { excluded.add(t.id); queue.push(t.id); });
        }
        const rows = buildTableRows(tasks, new Set()).filter(r => !excluded.has(r.task.id));
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
            onClick={() => setSetParentFor(null)}>
            <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 20, width: "100%", maxWidth: 420, maxHeight: "75vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>
                Nest <span style={{ color: GOLD }}>{setParentFor.name}</span> under…
              </h3>
              <p className="text-[11px] mb-3" style={{ color: "#484f58" }}>Pick any task to make it the parent. Full tree shown.</p>
              <div className="space-y-0.5">
                {setParentFor.parentId && (
                  <button
                    onClick={() => handleSetParent(setParentFor, null)}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs transition-colors hover:bg-[#2d1a1a]"
                    style={{ color: "#f87171", border: "1px solid #f8717133" }}
                  >
                    🔓 Remove parent (make top-level)
                  </button>
                )}
                {rows.map(row => {
                  const isCurrentParent = setParentFor.parentId === row.task.id;
                  return (
                    <button
                      key={row.task.id}
                      onClick={() => handleSetParent(setParentFor, row.task.id)}
                      className="w-full text-left rounded-lg text-sm transition-colors hover:bg-[#1e2736]"
                      style={{
                        paddingLeft: 12 + row.depth * 18,
                        paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                        color: isCurrentParent ? GOLD : "#e6edf3",
                        background: isCurrentParent ? "#1e2736" : "transparent",
                        fontWeight: row.hasChildren ? 600 : 400,
                      }}
                    >
                      <span className="text-[10px] font-mono mr-2" style={{ color: "#484f58" }}>{row.wbs}</span>
                      {isCurrentParent && <span style={{ color: GOLD }}>✓ </span>}
                      {row.task.name}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setSetParentFor(null)} className="mt-3 text-xs w-full py-2 rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── Edit Task Modal (for table view double-click) ─────────────────────────────

function EditTaskModal({
  task, companyId, clientId, onUpdate, onDelete, onClose, currentRow, totalRows, onMove,
}: {
  task: ClientTask; companyId: string; clientId: string;
  onUpdate: (updated: ClientTask) => void | Promise<void>; onDelete: (id: string) => void; onClose: () => void;
  currentRow?: number; totalRows?: number; onMove?: (toRow: number) => void;
}) {
  const [form, setForm] = useState({
    name: task.name,
    phase: task.phase,
    durationDays: String(task.durationDays),
    startDate: normDate(task.startDate) ?? "",
    endDate: normDate(task.endDate) ?? "",
    actualFinish: normDate(task.actualFinish) ?? "",
    percentComplete: String(task.percentComplete),
    status: task.status,
    priority: task.priority ?? "",
    assignee: task.assignee ?? "",
    trade: task.trade ?? "",
    notes: task.notes ?? "",
    predecessorIds: task.predecessorIds.join(", "),
    isMilestone: task.isMilestone,
    moveToRow: currentRow != null ? String(currentRow) : "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-recompute end date when start or duration changes
  function updateStart(val: string) {
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const s = parseDate(val);
    const newEnd = s ? toDateStr(addDays(s, dur - 1)) : form.endDate;
    setForm(f => ({ ...f, startDate: val, endDate: newEnd }));
  }
  function updateDuration(val: string) {
    const dur = Math.max(1, parseInt(val) || 1);
    const s = parseDate(form.startDate);
    const newEnd = s ? toDateStr(addDays(s, dur - 1)) : form.endDate;
    setForm(f => ({ ...f, durationDays: val, endDate: newEnd }));
  }

  async function handleSave() {
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const body = {
      name: form.name.trim() || task.name,
      phase: form.phase.trim() || "General",
      durationDays: dur,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      actualFinish: form.actualFinish || null,
      percentComplete: Math.min(100, Math.max(0, parseInt(form.percentComplete) || 0)),
      status: form.status,
      priority: form.priority || null,
      assignee: form.assignee.trim() || null,
      trade: form.trade.trim() || null,
      notes: form.notes.trim() || null,
      predecessorIds: form.predecessorIds.split(",").map(s => s.trim()).filter(Boolean),
      isMilestone: form.isMilestone,
    };
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.json();
      await onUpdate({
        ...task, ...raw,
        startDate: normDate(raw.startDate) ?? body.startDate,
        endDate: normDate(raw.endDate) ?? body.endDate,
        actualFinish: normDate(raw.actualFinish),
        durationDays: raw.durationDays ?? dur,
      });
      // Queue row move then close (pendingMoveRef fires in useEffect after editTask → null)
      const targetRow = parseInt(form.moveToRow);
      if (onMove && !isNaN(targetRow) && currentRow != null && targetRow !== currentRow) {
        onMove(targetRow);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, { method: "DELETE" });
    onDelete(task.id);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 24, width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: "#e6edf3" }}>Edit Task</h3>
          <div className="flex gap-2 items-center">
            {confirmDelete ? (
              <>
                <span className="text-xs" style={{ color: "#8b949e" }}>Delete this task?</span>
                <button onClick={handleDelete} className="text-xs px-2 py-1 rounded font-bold" style={{ background: "#f8514922", color: "#f85149" }}>Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded" style={{ color: "#8b949e", border: "1px solid #30373f" }}>No</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs px-2 py-1 rounded" style={{ background: "#2d1b1b", color: "#f87171" }}>Delete</button>
            )}
            <button onClick={onClose} className="text-lg leading-none ml-1" style={{ color: "#8b949e" }}>×</button>
          </div>
        </div>

        {onMove && currentRow != null && (
          <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: "1px solid #21262d" }}>
            <span className="text-xs shrink-0" style={{ color: "#8b949e" }}>Task #</span>
            <input type="number" min="1" max={totalRows ?? 999} step="1" value={form.moveToRow}
              onChange={e => setForm(f => ({ ...f, moveToRow: e.target.value }))}
              style={{ ...INPUT, width: 60, textAlign: "center" }} className="outline-none" />
            <span className="text-[10px]" style={{ color: "#484f58" }}>sequential # (not WBS) · currently #{currentRow} of {totalRows}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Phase</label>
              <input value={form.phase} onChange={e => setForm(f => ({ ...f, phase: e.target.value }))} style={INPUT} className="outline-none" placeholder="General" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Duration (days)</label>
              <input type="number" min="1" value={form.durationDays} onChange={e => updateDuration(e.target.value)} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Planned Start</label>
              <input type="date" value={form.startDate} onChange={e => updateStart(e.target.value)} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Planned End <span style={{ color: "#484f58", fontWeight: 400 }}>(auto)</span></label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Actual Finish</label>
              <input type="date" value={form.actualFinish} onChange={e => setForm(f => ({ ...f, actualFinish: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>% Complete</label>
              <input type="number" min="0" max="100" value={form.percentComplete} onChange={e => setForm(f => ({ ...f, percentComplete: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ ...INPUT, cursor: "pointer", appearance: "none" }} className="outline-none">
                <option value="">— None —</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Assignee</label>
              <input value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Crew A" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Trade</label>
              <input value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))} style={INPUT} className="outline-none" placeholder="e.g. Framing" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} style={{ ...INPUT, resize: "none" }} className="outline-none" />
          </div>

          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Linked From — task IDs that must finish before this task can start (comma-separated)</label>
            <textarea value={form.predecessorIds} onChange={e => setForm(f => ({ ...f, predecessorIds: e.target.value }))} rows={2} style={{ ...INPUT, resize: "none", fontFamily: "monospace", fontSize: 11 }} className="outline-none" placeholder="task-id-1, task-id-2, ..." />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-xs" style={{ color: "#8b949e" }}>
            <input type="checkbox" checked={form.isMilestone} onChange={e => setForm(f => ({ ...f, isMilestone: e.target.checked }))} />
            Milestone
          </label>
        </div>


        <div className="flex gap-2 mt-5">
          <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Table View ────────────────────────────────────────────────────────

function fmtDate(s: string | null | undefined): string {
  if (!s) return "";
  const d = parseDate(s);
  if (!d) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

type TableRow = {
  task: ClientTask;
  rowNum: number;    // 1-based sequential
  depth: number;
  wbs: string;
  hasChildren: boolean;
};

function buildTableRows(tasks: ClientTask[], collapsedIds: Set<string>): TableRow[] {
  // Sort tasks by sortOrder
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  // Build parent→children map
  const childrenOf = new Map<string | null, ClientTask[]>();
  for (const t of sorted) {
    const pid = t.parentId ?? null;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(t);
  }

  const hasChildrenSet = new Set<string>();
  for (const t of sorted) {
    if (t.parentId) hasChildrenSet.add(t.parentId);
  }

  // Compute depth
  const depthOf = new Map<string, number>();
  function getDepth(id: string): number {
    if (depthOf.has(id)) return depthOf.get(id)!;
    const task = sorted.find(t => t.id === id);
    if (!task || !task.parentId) { depthOf.set(id, 0); return 0; }
    const d = getDepth(task.parentId) + 1;
    depthOf.set(id, d);
    return d;
  }
  for (const t of sorted) getDepth(t.id);

  // WBS numbering: assign sequential numbers at each level
  const wbsOf = new Map<string, string>();
  function assignWbs(parentId: string | null, prefix: string) {
    const children = childrenOf.get(parentId) ?? [];
    children.forEach((t, idx) => {
      const wbs = prefix ? `${prefix}.${idx + 1}` : String(idx + 1);
      wbsOf.set(t.id, wbs);
      assignWbs(t.id, wbs);
    });
  }
  assignWbs(null, "");

  // Flatten in tree order, respecting collapse
  const rows: TableRow[] = [];
  let rowNum = 0;

  function visit(parentId: string | null) {
    const children = childrenOf.get(parentId) ?? [];
    for (const t of children) {
      rowNum++;
      rows.push({
        task: t,
        rowNum,
        depth: depthOf.get(t.id) ?? 0,
        wbs: wbsOf.get(t.id) ?? "",
        hasChildren: hasChildrenSet.has(t.id),
      });
      if (!collapsedIds.has(t.id)) {
        visit(t.id);
      }
    }
  }
  visit(null);

  return rows;
}

// ── Task Info Panel ────────────────────────────────────────────────────────────
const LINK_TYPE_LABELS: Record<LinkType, string> = {
  FS: "Finish to Start",
  SS: "Start to Start",
  FF: "Finish to Finish",
  SF: "Start to Finish",
};

function TaskInfoPanel({
  task, tasks, companyId, clientId, tab, onTabChange, onClose, onTasksChange,
}: {
  task: ClientTask; tasks: ClientTask[]; companyId: string; clientId: string;
  tab: "links"; onTabChange: (t: "links") => void; onClose: () => void;
  onTasksChange: (tasks: ClientTask[]) => void;
}) {
  const links: TaskLink[] = task.predecessors && task.predecessors.length > 0
    ? task.predecessors
    : task.predecessorIds.map(id => ({ id, type: "FS" as LinkType, lag: 0 }));

  const [addingLink, setAddingLink] = useState(false);
  const [newLinkTaskId, setNewLinkTaskId] = useState("");
  const [newLinkType, setNewLinkType] = useState<LinkType>("FS");
  const [newLinkLag, setNewLinkLag] = useState(0);
  const [saving, setSaving] = useState(false);

  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => a.sortOrder - b.sortOrder).filter(t => t.id !== task.id),
    [tasks, task.id]
  );

  async function saveLinks(newLinks: TaskLink[]) {
    setSaving(true);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predecessors: newLinks,
          predecessorIds: newLinks.map(l => l.id),
        }),
      });
      const raw = await res.json();
      onTasksChange(tasks.map(t => t.id === task.id ? { ...t, predecessors: newLinks, predecessorIds: newLinks.map(l => l.id), ...raw } : t));
    } finally {
      setSaving(false);
    }
  }

  async function addLink() {
    if (!newLinkTaskId) return;
    const exists = links.find(l => l.id === newLinkTaskId);
    if (exists) return;
    const newLinks = [...links, { id: newLinkTaskId, type: newLinkType, lag: newLinkLag }];
    await saveLinks(newLinks);
    setAddingLink(false);
    setNewLinkTaskId("");
    setNewLinkType("FS");
    setNewLinkLag(0);
  }

  async function updateLink(idx: number, patch: Partial<TaskLink>) {
    const newLinks = links.map((l, i) => i === idx ? { ...l, ...patch } : l);
    await saveLinks(newLinks);
  }

  async function removeLink(idx: number) {
    const newLinks = links.filter((_, i) => i !== idx);
    await saveLinks(newLinks);
  }

  const SEL: React.CSSProperties = { background: "#0d1117", border: "1px solid #30373f", borderRadius: 6, color: "#e6edf3", fontSize: 12, padding: "3px 6px" };

  return (
    <div style={{ borderTop: "1px solid #30373f", background: "#0d1117", padding: "0 0 16px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: GOLD }}>{task.name}</span>
          <div className="flex gap-1">
            {(["links"] as const).map(t => (
              <button key={t} onClick={() => onTabChange(t)}
                className="px-3 py-1 text-xs font-semibold rounded-md uppercase tracking-widest"
                style={{ background: tab === t ? GOLD : "transparent", color: tab === t ? "#0d1117" : "#8b949e", border: "1px solid " + (tab === t ? GOLD : "#30373f") }}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onClose} style={{ color: "#484f58", fontSize: 18, lineHeight: 1 }}>×</button>
      </div>

      {/* Links tab */}
      {tab === "links" && (
        <div className="px-4">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #21262d" }}>
                <th style={{ padding: "4px 8px", textAlign: "left", color: "#484f58", fontWeight: 600, width: 50 }}>#</th>
                <th style={{ padding: "4px 8px", textAlign: "left", color: "#484f58", fontWeight: 600 }}>TASK NAME</th>
                <th style={{ padding: "4px 8px", textAlign: "left", color: "#484f58", fontWeight: 600, width: 160 }}>LINK TYPE</th>
                <th style={{ padding: "4px 8px", textAlign: "left", color: "#484f58", fontWeight: 600, width: 90 }}>LAG (days)</th>
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {links.map((link, idx) => {
                const pred = tasks.find(t => t.id === link.id);
                const predRow = [...tasks].sort((a,b) => a.sortOrder - b.sortOrder).findIndex(t => t.id === link.id) + 1;
                return (
                  <tr key={link.id} style={{ borderBottom: "1px solid #161b22" }}>
                    <td style={{ padding: "5px 8px", color: "#484f58" }}>{predRow}</td>
                    <td style={{ padding: "5px 8px", color: "#e6edf3" }}>{pred?.name ?? link.id}</td>
                    <td style={{ padding: "5px 8px" }}>
                      <select value={link.type} onChange={e => updateLink(idx, { type: e.target.value as LinkType })} style={SEL} disabled={saving}>
                        {(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map(lt => (
                          <option key={lt} value={lt}>{LINK_TYPE_LABELS[lt]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: "5px 8px" }}>
                      <input type="number" value={link.lag} min={-999} max={999}
                        onChange={e => updateLink(idx, { lag: parseInt(e.target.value) || 0 })}
                        style={{ ...SEL, width: 60, textAlign: "center" }} disabled={saving} />
                    </td>
                    <td style={{ padding: "5px 4px" }}>
                      <button onClick={() => removeLink(idx)} style={{ color: "#f85149", fontSize: 16, lineHeight: 1 }} disabled={saving}>×</button>
                    </td>
                  </tr>
                );
              })}

              {addingLink && (
                <tr style={{ borderBottom: "1px solid #161b22" }}>
                  <td />
                  <td style={{ padding: "5px 8px" }}>
                    <select value={newLinkTaskId} onChange={e => setNewLinkTaskId(e.target.value)} style={{ ...SEL, width: "100%" }}>
                      <option value="">— select task —</option>
                      {sortedTasks.map((t, i) => (
                        <option key={t.id} value={t.id}>{i + 1}. {t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <select value={newLinkType} onChange={e => setNewLinkType(e.target.value as LinkType)} style={SEL}>
                      {(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map(lt => (
                        <option key={lt} value={lt}>{LINK_TYPE_LABELS[lt]}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "5px 8px" }}>
                    <input type="number" value={newLinkLag} min={-999} max={999}
                      onChange={e => setNewLinkLag(parseInt(e.target.value) || 0)}
                      style={{ ...SEL, width: 60, textAlign: "center" }} />
                  </td>
                  <td style={{ padding: "5px 4px", display: "flex", gap: 4 }}>
                    <button onClick={addLink} disabled={!newLinkTaskId || saving}
                      style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: GOLD, color: "#0d1117", fontWeight: 700 }}>Add</button>
                    <button onClick={() => setAddingLink(false)} style={{ fontSize: 11, padding: "2px 6px", color: "#484f58" }}>✕</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {!addingLink && (
            <button onClick={() => setAddingLink(true)}
              className="mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "#1e2736", border: `1px solid ${GOLD}44`, color: GOLD }}>
              + Add Link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleTableView({
  tasks, companyId, clientId, onTasksChange, canEdit,
}: {
  tasks: ClientTask[]; companyId: string; clientId: string;
  onTasksChange: (tasks: ClientTask[]) => void; canEdit: boolean;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editTask, setEditTask] = useState<ClientTask | null>(null);
  const [addSubFor, setAddSubFor] = useState<ClientTask | null>(null);
  const [addPhaseCtx, setAddPhaseCtx] = useState<{ insertAfterId: string } | null>(null);
  const [addTaskSiblingFor, setAddTaskSiblingFor] = useState<ClientTask | null>(null);
  const [assignTasksFor, setAssignTasksFor] = useState<ClientTask | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const [settingParentFor, setSettingParentFor] = useState<ClientTask | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; task: ClientTask } | null>(null);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [infoTab, setInfoTab] = useState<"links">("links");
  const [colWidths, setColWidths] = useState({ num: 44, link: 72, wbs: 76, name: 260, dur: 82, pct: 52, start: 106, end: 106, actual: 106, priority: 82, status: 108, assignee: 120 });

  const phases = useMemo(() => Array.from(new Set(tasks.map(t => t.phase))), [tasks]);
  const phaseNames = useMemo(() => new Set(tasks.map(t => t.phase)), [tasks]);
  const rows = useMemo(() => buildTableRows(tasks, collapsedIds), [tasks, collapsedIds]);
  const idToRow = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) m.set(r.task.id, r.rowNum); return m; }, [rows]);

  // Refs so drag/move callbacks always see latest data (no stale closure)
  const rowsRef = useRef<TableRow[]>([]);
  const tasksRef = useRef<ClientTask[]>(tasks);
  const dropIdRef = useRef<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  // Keep selectedTask in sync with latest task data
  useEffect(() => { if (selectedTask) setSelectedTask(tasks.find(t => t.id === selectedTask.id) ?? null); }, [tasks]);

  // Close context menu on outside click; ESC cancels parent-set mode
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSettingParentFor(null); setCtxMenu(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapse(id: string) {
    setCollapsedIds(prev => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  // ── Column resize ─────────────────────────────────────────────────────────
  function startResize(col: keyof typeof colWidths, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = colWidths[col];
    const onMove = (ev: MouseEvent) => setColWidths(p => ({ ...p, [col]: Math.max(36, startW + ev.clientX - startX) }));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
  }

  // ── Mouse-based drag to reorder (works in all browsers) ──────────────────
  function startDrag(taskId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragIdRef.current = taskId;
    setDragId(taskId);
    dropIdRef.current = null;

    function handleMove(ev: MouseEvent) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const tr = el?.closest("tr[data-task-id]");
      const rowId = tr?.getAttribute("data-task-id");
      if (rowId && rowId !== taskId && rowId !== dropIdRef.current) {
        dropIdRef.current = rowId;
        setDropId(rowId);
      }
    }

    function handleUp() {
      const target = dropIdRef.current;
      dragIdRef.current = null;
      setDragId(null);
      setDropId(null);
      dropIdRef.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);

      if (!target || target === taskId) return;
      const flatIds = rowsRef.current.map(r => r.task.id);
      if (!flatIds.includes(taskId) || !flatIds.includes(target)) return;
      const filtered = flatIds.filter(id => id !== taskId);
      filtered.splice(filtered.indexOf(target), 0, taskId); // insert before drop target
      const newOrders = new Map(filtered.map((id, i) => [id, i]));
      const updated = tasksRef.current.map(t => ({ ...t, sortOrder: newOrders.get(t.id) ?? t.sortOrder }));
      onTasksChange(updated);
      Promise.all(filtered.map(id => {
        const t = updated.find(x => x.id === id);
        if (!t) return Promise.resolve();
        return fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: t.sortOrder }),
        });
      }));
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }

  // ── Indent: make task child of the task immediately above it ─────────────
  async function indent(task: ClientTask) {
    const flatIds = rows.map(r => r.task.id);
    const idx = flatIds.indexOf(task.id);
    if (idx <= 0) return;
    const parentTask = rows[idx - 1].task;
    if (parentTask.id === task.id) return;
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: parentTask.id }),
    });
    onTasksChange(tasks.map(t => t.id === task.id ? { ...t, parentId: parentTask.id } : t));
  }

  // ── Outdent: remove one level (set parent to grandparent or null) ─────────
  async function outdent(task: ClientTask) {
    if (!task.parentId) return;
    const parent = tasks.find(t => t.id === task.parentId);
    const newParentId = parent?.parentId ?? null;
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: newParentId }),
    });
    onTasksChange(tasks.map(t => t.id === task.id ? { ...t, parentId: newParentId } : t));
  }

  // ── Set parent via click ──────────────────────────────────────────────────
  async function handleSetParent(parentTask: ClientTask) {
    if (!settingParentFor || parentTask.id === settingParentFor.id) { setSettingParentFor(null); return; }
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${settingParentFor.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: parentTask.id }),
    });
    onTasksChange(tasks.map(t => t.id === settingParentFor.id ? { ...t, parentId: parentTask.id } : t));
    setSettingParentFor(null);
  }

  async function removeParent(task: ClientTask) {
    await fetch(`/api/${companyId}/clients/${clientId}/schedule/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: null }),
    });
    onTasksChange(tasks.map(t => t.id === task.id ? { ...t, parentId: null } : t));
  }

  // ── Predecessor cascade (respects link type: FS, SS, FF, SF) ─────────────
  async function cascadeFromTask(updatedTask: ClientTask): Promise<ClientTask[]> {
    let current = tasks.map(t => t.id === updatedTask.id ? updatedTask : t);
    const queue = [updatedTask.id];
    const visited = new Set<string>();

    // Helper: resolve effective link list for a task (use predecessors if set, else predecessorIds as FS)
    function getLinks(t: ClientTask): TaskLink[] {
      if (t.predecessors && t.predecessors.length > 0) return t.predecessors;
      return t.predecessorIds.map(id => ({ id, type: "FS" as LinkType, lag: 0 }));
    }

    while (queue.length > 0) {
      const taskId = queue.shift()!;
      if (visited.has(taskId)) continue;
      visited.add(taskId);
      const source = current.find(t => t.id === taskId);
      if (!source) continue;

      const dependents = current.filter(t => getLinks(t).some(l => l.id === taskId));
      for (const dep of dependents) {
        const links = getLinks(dep);
        // Compute earliest start and latest end from all linked predecessors
        let newStart = dep.startDate;
        let newEnd = dep.endDate;

        for (const link of links) {
          const pred = current.find(t => t.id === link.id);
          if (!pred) continue;
          const lag = link.lag ?? 0;
          const dur = dep.durationDays;

          if (link.type === "FS") {
            // dep starts after pred ends + lag
            if (!pred.endDate) continue;
            const predEnd = parseDate(pred.endDate);
            if (!predEnd) continue;
            const s = toDateStr(addDays(predEnd, 1 + lag));
            const e = toDateStr(addDays(parseDate(s)!, dur - 1));
            if (!newStart || s > newStart) { newStart = s; newEnd = e; }
          } else if (link.type === "SS") {
            // dep starts when pred starts + lag
            if (!pred.startDate) continue;
            const s = toDateStr(addDays(parseDate(pred.startDate)!, lag));
            const e = toDateStr(addDays(parseDate(s)!, dur - 1));
            if (!newStart || s > newStart) { newStart = s; newEnd = e; }
          } else if (link.type === "FF") {
            // dep ends when pred ends + lag
            if (!pred.endDate) continue;
            const e = toDateStr(addDays(parseDate(pred.endDate)!, lag));
            const s = toDateStr(addDays(parseDate(e)!, -(dur - 1)));
            if (!newEnd || e > newEnd) { newStart = s; newEnd = e; }
          } else if (link.type === "SF") {
            // dep ends when pred starts + lag
            if (!pred.startDate) continue;
            const e = toDateStr(addDays(parseDate(pred.startDate)!, lag));
            const s = toDateStr(addDays(parseDate(e)!, -(dur - 1)));
            if (!newEnd || e > newEnd) { newStart = s; newEnd = e; }
          }
        }

        if (newStart === dep.startDate && newEnd === dep.endDate) continue;
        await fetch(`/api/${companyId}/clients/${clientId}/schedule/${dep.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: newStart, endDate: newEnd }),
        });
        current = current.map(t => t.id === dep.id ? { ...t, startDate: newStart, endDate: newEnd } : t);
        queue.push(dep.id);
      }
    }
    return current;
  }

  // ── Style helpers ─────────────────────────────────────────────────────────
  type CK = keyof typeof colWidths;
  function onThMouseDown(key: keyof typeof colWidths, e: React.MouseEvent<HTMLTableCellElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX >= rect.right - 12) {
      startResize(key, e);
    }
  }
  function onThMouseMove(e: React.MouseEvent<HTMLTableCellElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.cursor = e.clientX >= rect.right - 12 ? "col-resize" : "default";
  }
  function onThMouseLeave(e: React.MouseEvent<HTMLTableCellElement>) {
    e.currentTarget.style.cursor = "default";
  }

  const col = (k: CK, extra?: React.CSSProperties): React.CSSProperties => ({
    width: colWidths[k], minWidth: colWidths[k], maxWidth: colWidths[k], padding: "0 8px", borderRight: "1px solid #21262d",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    fontSize: 12, color: "#e6edf3", height: 36, display: "table-cell", verticalAlign: "middle",
    position: "relative", ...extra,
  });
  const th = (k: CK, extra?: React.CSSProperties): React.CSSProperties => ({
    ...col(k), background: "#161b22", color: "#8b949e", fontWeight: 700, fontSize: 11,
    letterSpacing: "0.04em", textTransform: "uppercase" as const,
    height: 32, position: "sticky" as const, top: 0, zIndex: 2, userSelect: "none" as const,
    overflow: "visible" as const, ...extra,
  });

  function statusLabel(s: string) { return ({ NOT_STARTED: "To Do", IN_PROGRESS: "In Progress", DONE: "Done", BLOCKED: "Blocked" } as Record<string,string>)[s] ?? s; }
  function statusColor(s: string) { return ({ NOT_STARTED: GOLD, IN_PROGRESS: "#3b82f6", DONE: "#22c55e", BLOCKED: "#f97316" } as Record<string,string>)[s] ?? "#8b949e"; }
  function priorityColor(p: string | null) { return p === "HIGH" ? "#f87171" : p === "MEDIUM" ? GOLD : p === "LOW" ? "#22c55e" : "#8b949e"; }

  const CTX_BTN: React.CSSProperties = { display: "block", width: "100%", padding: "9px 16px", textAlign: "left", background: "none", border: "none", color: "#e6edf3", fontSize: 13, cursor: "pointer" };

  // Compute all IDs that have children (for collapse all)
  const parentIdSet = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) { if (t.parentId) s.add(t.parentId); }
    return s;
  }, [tasks]);

  return (
    <>
      {/* Parent-set banner */}
      {settingParentFor && (
        <div style={{ background: "#1a2744", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: GOLD, fontSize: 13 }}>🔗 Click any task to set as parent of <strong>&ldquo;{settingParentFor.name}&rdquo;</strong> — or press ESC to cancel</span>
          <button onClick={() => setSettingParentFor(null)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Collapse/expand toolbar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button onClick={() => setCollapsedIds(new Set(parentIdSet))}
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          ▶ Collapse All
        </button>
        <button onClick={() => setCollapsedIds(new Set())}
          style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e", borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          ▼ Expand All
        </button>
      </div>

      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh", borderRadius: 8, border: "1px solid #21262d" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", minWidth: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...th("num"), position: "sticky", left: 0, zIndex: 3, textAlign: "center" }}
                onMouseDown={e => onThMouseDown("num", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>#</th>
              <th style={th("link")} title="Predecessor row numbers"
                onMouseDown={e => onThMouseDown("link", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>LINKED FROM</th>
              <th style={th("wbs")}
                onMouseDown={e => onThMouseDown("wbs", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>WBS</th>
              <th style={{ ...th("name"), textAlign: "left" }}
                onMouseDown={e => onThMouseDown("name", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>TASK NAME</th>
              <th style={{ ...th("dur"), textAlign: "center" }}
                onMouseDown={e => onThMouseDown("dur", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>DURATION</th>
              <th style={{ ...th("pct"), textAlign: "center" }}
                onMouseDown={e => onThMouseDown("pct", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>%</th>
              <th style={th("start")}
                onMouseDown={e => onThMouseDown("start", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>PLANNED START</th>
              <th style={th("end")}
                onMouseDown={e => onThMouseDown("end", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>PLANNED END</th>
              <th style={th("actual")}
                onMouseDown={e => onThMouseDown("actual", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>ACTUAL FINISH</th>
              <th style={{ ...th("priority"), textAlign: "center" }}
                onMouseDown={e => onThMouseDown("priority", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>PRIORITY</th>
              <th style={th("status")}
                onMouseDown={e => onThMouseDown("status", e)} onMouseMove={onThMouseMove} onMouseLeave={onThMouseLeave}>STATUS</th>
              <th style={{ ...th("assignee"), borderRight: "none" }}>ASSIGNEE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const { task, rowNum: rn, depth, wbs, hasChildren } = r;
              const isDragging = dragId === task.id;
              const isDropOver = dropId === task.id && dragId !== task.id;
              const isSection = hasChildren || (!task.parentId && phaseNames.has(task.name));
              const rowBg = isDropOver ? "#1f3a5f" : isSection ? "#191f2b" : rn % 2 === 0 ? "#0d1117" : "#0a0e14";
              const linkStr = task.predecessorIds.map(pid => idToRow.get(pid)).filter(Boolean).join(", ");

              // For section rows: compute duration/start/end from all descendants
              let displayDuration = task.durationDays;
              let displayStart = task.startDate;
              let displayEnd = task.endDate;
              let displayPct = task.percentComplete;
              if (isSection) {
                const descendants = tasks.filter(t => {
                  let cur = t;
                  while (cur.parentId) {
                    if (cur.parentId === task.id) return true;
                    cur = tasks.find(x => x.id === cur.parentId) ?? cur;
                    if (cur === t) break;
                  }
                  return false;
                });
                const allDates = descendants.flatMap(t => [t.startDate, t.endDate]).filter(Boolean) as string[];
                if (allDates.length) {
                  const sorted = [...allDates].sort();
                  displayStart = sorted[0];
                  displayEnd = sorted[sorted.length - 1];
                  const s = parseDate(displayStart), e = parseDate(displayEnd);
                  if (s && e) displayDuration = differenceInDays(e, s) + 1;
                }
                const doneCount = descendants.filter(t => t.status === "DONE").length;
                displayPct = descendants.length ? Math.round((doneCount / descendants.length) * 100) : 0;
              }

              return (
                <tr key={task.id} data-task-id={task.id}
                  onDoubleClick={() => !settingParentFor && setEditTask(task)}
                  onClick={() => { if (settingParentFor) { handleSetParent(task); } else { setSelectedTask(t => t?.id === task.id ? null : task); } }}
                  onContextMenu={e => { if (!canEdit) return; e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, task }); }}
                  style={{
                    background: rowBg, opacity: isDragging ? 0.3 : 1, transition: "opacity 0.1s",
                    cursor: settingParentFor ? "crosshair" : "default",
                    boxShadow: isDropOver ? `inset 0 2px 0 ${GOLD}` : isSection ? `inset 3px 0 0 ${GOLD}44` : undefined,
                  }}
                  className="hover:brightness-110"
                >
                  {/* # drag handle */}
                  <td style={{ ...col("num"), position: "sticky", left: 0, background: rowBg, zIndex: 1, color: "#484f58", textAlign: "center", cursor: canEdit ? (dragId ? "grabbing" : "grab") : "default" }}
                    onMouseDown={e => canEdit && startDrag(task.id, e)}>
                    <span style={{ userSelect: "none", fontSize: 11 }}>{canEdit ? "⠿ " : ""}{rn}</span>
                  </td>
                  {/* LINKED FROM */}
                  <td style={{ ...col("link"), color: "#8b949e", textAlign: "center", fontWeight: isSection ? 700 : 400 }}>{linkStr}</td>
                  {/* WBS */}
                  <td style={{ ...col("wbs"), color: isSection ? GOLD : "#8b949e", fontWeight: isSection ? 700 : 400 }}>{wbs}</td>
                  {/* TASK NAME */}
                  <td style={{ ...col("name"), paddingLeft: 8 + depth * 16, fontWeight: isSection ? 700 : 400, color: isSection ? GOLD : task.status === "DONE" ? "#484f58" : "#e6edf3" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "100%", overflow: "hidden" }}>
                      {hasChildren && (
                        <button onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, padding: 0, fontSize: 11, flexShrink: 0, opacity: 0.8 }}>
                          {collapsedIds.has(task.id) ? "▶" : "▼"}
                        </button>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.isMilestone ? "◆ " : ""}{task.name}
                      </span>
                    </span>
                  </td>
                  {/* DURATION */}
                  <td style={{ ...col("dur"), textAlign: "center", color: isSection ? "#e6edf3" : "#8b949e", fontWeight: isSection ? 700 : 400 }}>
                    {displayDuration === 1 ? "1 day" : `${displayDuration} days`}
                  </td>
                  {/* % */}
                  <td style={{ ...col("pct"), textAlign: "center", color: displayPct === 100 ? "#22c55e" : isSection ? "#e6edf3" : "#e6edf3", fontWeight: isSection ? 700 : 400 }}>
                    {displayPct}%
                  </td>
                  {/* PLANNED START */}
                  <td style={{ ...col("start"), color: isSection ? "#e6edf3" : "#8b949e", fontWeight: isSection ? 700 : 400 }}>{fmtDate(displayStart)}</td>
                  {/* PLANNED END */}
                  <td style={{ ...col("end"), color: isSection ? "#e6edf3" : "#8b949e", fontWeight: isSection ? 700 : 400 }}>{fmtDate(displayEnd)}</td>
                  {/* ACTUAL FINISH */}
                  <td style={{ ...col("actual"), color: task.actualFinish ? "#22c55e" : "#484f58" }}>{fmtDate(task.actualFinish)}</td>
                  {/* PRIORITY */}
                  <td style={{ ...col("priority"), color: priorityColor(task.priority), fontWeight: task.priority ? 600 : 400, textAlign: "center" }}>{task.priority ?? ""}</td>
                  {/* STATUS */}
                  <td style={{ ...col("status"), color: isSection ? "#e6edf3" : statusColor(task.status), fontWeight: isSection ? 700 : 400 }}>
                    {isSection ? `${displayPct}%` : statusLabel(task.status)}
                  </td>
                  {/* ASSIGNEE + subtask button */}
                  <td style={{ ...col("assignee"), borderRight: "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {task.assignee ? (task.assignee.length > 12 ? task.assignee.slice(0, 12) + "…" : task.assignee) : ""}
                      </span>
                      {canEdit && (
                        <button onClick={e => { e.stopPropagation(); setAddSubFor(task); }}
                          title="Add subtask"
                          style={{ flexShrink: 0, background: "none", border: "1px solid #30373f", borderRadius: 4, color: "#8b949e", fontSize: 12, lineHeight: 1, cursor: "pointer", padding: "1px 5px" }}>
                          +
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context menu */}
      {ctxMenu && (() => {
        const menuW = 210;
        const menuH = ctxMenu.task.parentId ? 310 : 280;
        const top = ctxMenu.y + menuH > window.innerHeight - 8 ? Math.max(8, ctxMenu.y - menuH) : ctxMenu.y;
        const left = ctxMenu.x + menuW > window.innerWidth - 8 ? ctxMenu.x - menuW : ctxMenu.x;
        return (
        <div style={{ position: "fixed", left, top, background: "#1e2736", border: "1px solid #30373f", borderRadius: 8, zIndex: 200, minWidth: menuW, boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden" }}
          onClick={e => e.stopPropagation()}>
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { setEditTask(ctxMenu.task); setCtxMenu(null); }}>✏️ Edit Task</button>
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { setAddSubFor(ctxMenu.task); setCtxMenu(null); }}>⊕ Add Subtask</button>
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { setAddTaskSiblingFor(ctxMenu.task); setCtxMenu(null); }}>📋 Add Task here</button>
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { setAddPhaseCtx({ insertAfterId: ctxMenu.task.id }); setCtxMenu(null); }}>📁 Add Phase</button>
          <div style={{ height: 1, background: "#21262d", margin: "2px 0" }} />
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { indent(ctxMenu.task); setCtxMenu(null); }} title="Make child of the task above it">
            → Indent
          </button>
          <button style={{ ...CTX_BTN, color: ctxMenu.task.parentId ? "#e6edf3" : "#484f58" }} className="hover:bg-[#2d3748]"
            onClick={() => { if (ctxMenu.task.parentId) { outdent(ctxMenu.task); setCtxMenu(null); } }}>
            ← Outdent
          </button>
          <button style={CTX_BTN} className="hover:bg-[#2d3748]" onClick={() => { setSettingParentFor(ctxMenu.task); setCtxMenu(null); }}>📂 Nest under…</button>
          {ctxMenu.task.parentId && (
            <button style={{ ...CTX_BTN, color: "#f87171" }} className="hover:bg-[#2d3748]" onClick={() => { removeParent(ctxMenu.task); setCtxMenu(null); }}>✕ Remove Parent</button>
          )}
        </div>
        );
      })()}

      {editTask && (
        <EditTaskModal task={editTask} companyId={companyId} clientId={clientId}
          currentRow={(() => { const s = [...tasks].sort((a,b) => a.sortOrder - b.sortOrder); const i = s.findIndex(t => t.id === editTask.id); return i >= 0 ? i + 1 : undefined; })()}
          totalRows={tasks.length}
          onUpdate={async updated => {
            let cascaded = await cascadeFromTask(updated);
            // If phase changed to match an existing phase-header task, auto-nest under it
            const prevPhase = editTask.phase;
            if (updated.phase !== prevPhase) {
              const header = tasks.find(t => t.name === updated.phase && t.id !== updated.id && !t.parentId);
              if (header) {
                await fetch(`/api/${companyId}/clients/${clientId}/schedule/${updated.id}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ parentId: header.id }),
                });
                cascaded = cascaded.map(t => t.id === updated.id ? { ...t, parentId: header.id } : t);
              }
            }
            onTasksChange(cascaded);
          }}
          onDelete={id => { onTasksChange(tasks.filter(t => t.id !== id)); setEditTask(null); }}
          onMove={toRow => {
            const taskId = editTask.id;
            const sortedIds = [...tasksRef.current].sort((a, b) => a.sortOrder - b.sortOrder).map(t => t.id);
            if (!sortedIds.includes(taskId)) return;
            const filtered = sortedIds.filter(id => id !== taskId);
            filtered.splice(Math.max(0, Math.min(filtered.length, toRow - 1)), 0, taskId);
            const newOrders = new Map(filtered.map((id, i) => [id, i]));
            const updated = tasksRef.current.map(t => ({ ...t, sortOrder: newOrders.get(t.id) ?? t.sortOrder }));
            onTasksChange(updated);
            Promise.all(filtered.map(id => {
              const t = updated.find(x => x.id === id);
              if (!t) return Promise.resolve();
              return fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: t.sortOrder }),
              });
            }));
          }}
          onClose={() => setEditTask(null)} />
      )}

      {addSubFor && (
        <AddTaskModal companyId={companyId} clientId={clientId} phases={phases}
          defaultParentId={addSubFor.id} defaultParentName={addSubFor.name}
          onCreate={task => { onTasksChange([...tasks, task]); setAddSubFor(null); }}
          onClose={() => setAddSubFor(null)} />
      )}

      {addPhaseCtx && (
        <AddTaskModal companyId={companyId} clientId={clientId} phases={phases}
          defaultMode="phase"
          onCreate={async task => {
            // Insert new phase right after the right-clicked row
            const allWithNew = [...tasks, task];
            const sortedIds = [...allWithNew].sort((a, b) => a.sortOrder - b.sortOrder).map(t => t.id);
            const afterIdx = sortedIds.indexOf(addPhaseCtx.insertAfterId);
            const without = sortedIds.filter(id => id !== task.id);
            without.splice(afterIdx + 1, 0, task.id);
            const newOrders = new Map(without.map((id, i) => [id, i]));
            const reordered = allWithNew.map(t => ({ ...t, sortOrder: newOrders.get(t.id) ?? t.sortOrder }));
            onTasksChange(reordered);
            await Promise.all(reordered.map(t =>
              fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, {
                method: "PATCH", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sortOrder: t.sortOrder }),
              })
            ));
            setAddPhaseCtx(null);
            setAssignTasksFor(task);
          }}
          onClose={() => setAddPhaseCtx(null)} />
      )}

      {addTaskSiblingFor && (
        <AddTaskModal companyId={companyId} clientId={clientId} phases={phases}
          defaultParentId={addTaskSiblingFor.parentId ?? undefined}
          defaultMode="task"
          onCreate={task => { onTasksChange([...tasks, task]); setAddTaskSiblingFor(null); }}
          onClose={() => setAddTaskSiblingFor(null)} />
      )}

      {assignTasksFor && (
        <AssignTasksModal phaseTask={assignTasksFor} tasks={tasks} companyId={companyId} clientId={clientId}
          onAssigned={updated => { onTasksChange(updated); setAssignTasksFor(null); }}
          onClose={() => setAssignTasksFor(null)} />
      )}

      {/* ── Task Info Panel ── */}
      {selectedTask && (
        <TaskInfoPanel
          task={selectedTask}
          tasks={tasks}
          companyId={companyId}
          clientId={clientId}
          tab={infoTab}
          onTabChange={setInfoTab}
          onClose={() => setSelectedTask(null)}
          onTasksChange={onTasksChange}
        />
      )}
    </>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

function printScheduleHtml(tasks: ClientTask[]) {
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const phases = Array.from(new Set(sorted.map(t => t.phase)));
  const rows = phases.flatMap(phase => {
    const phaseTasks = sorted.filter(t => t.phase === phase);
    return [
      `<tr style="background:#f0f0f0"><td colspan="7" style="font-weight:bold;padding:6px 8px;font-size:12px">${phase}</td></tr>`,
      ...phaseTasks.map(t => `
        <tr style="${t.status === "DONE" ? "color:#888;text-decoration:line-through" : ""}">
          <td style="padding:4px 8px;${t.parentId ? "padding-left:22px" : ""}">${t.parentId ? "↳ " : ""}${t.name}${t.isMilestone ? " 🔷" : ""}</td>
          <td style="padding:4px 8px">${t.startDate ?? "–"}</td>
          <td style="padding:4px 8px">${t.endDate ?? "–"}</td>
          <td style="padding:4px 8px">${t.durationDays}d</td>
          <td style="padding:4px 8px">${t.trade ?? "–"}</td>
          <td style="padding:4px 8px">${t.assignee ?? "–"}</td>
          <td style="padding:4px 8px">${t.status.replace(/_/g, " ")}</td>
        </tr>
      `),
    ];
  });
  const html = `<!DOCTYPE html><html><head><title>Schedule</title><style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:20px}
    h1{font-size:16px;margin-bottom:4px}
    table{width:100%;border-collapse:collapse}
    th{background:#eee;padding:5px 8px;border:1px solid #ccc;text-align:left;font-size:11px}
    td{border:1px solid #eee}
    td:nth-child(2),td:nth-child(3){white-space:nowrap;width:82px}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
    <h1>Project Schedule</h1>
    <p style="color:#666;font-size:10px;margin-bottom:12px">Printed ${new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</p>
    <table><thead><tr>
      <th>Task</th><th>Start</th><th>End</th><th>Duration</th><th>Trade</th><th>Assignee</th><th>Status</th>
    </tr></thead><tbody>${rows.join("")}</tbody></table>
  </body></html>`;
  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); win.print(); }
}

function printGanttDiagram(tasks: ClientTask[], projectStart: Date, clientName: string) {
  const today = new Date();
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);
  const phases = new Map<string, ClientTask[]>();
  for (const t of sorted) { const arr = phases.get(t.phase) ?? []; arr.push(t); phases.set(t.phase, arr); }

  const parseD = (s: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(s + "T12:00:00");
    return isNaN(d.getTime()) ? null : d;
  };

  const allDates = tasks.flatMap(t => [parseD(t.startDate), parseD(t.endDate)]).filter(Boolean) as Date[];
  const projectEnd = allDates.length ? allDates.reduce((m, d) => d > m ? d : m, allDates[0]) : addDays(projectStart, 30);
  const totalDays = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / 86400000) + 4;

  const CELL_W = 12;
  const ROW_H = 18;
  const LABEL_W = 210;
  const HEADER_H = 20;
  const svgW = LABEL_W + totalDays * CELL_W;

  const monthHeaders: string[] = [];
  let cur = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1);
  while (cur <= projectEnd) {
    const startDay = Math.max(0, Math.ceil((cur.getTime() - projectStart.getTime()) / 86400000));
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const end = monthEnd < projectEnd ? monthEnd : projectEnd;
    const days = Math.ceil((end.getTime() - cur.getTime()) / 86400000) + 1;
    monthHeaders.push(
      `<rect x="${LABEL_W + startDay * CELL_W}" y="0" width="${days * CELL_W}" height="${HEADER_H}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.5"/>`,
      `<text x="${LABEL_W + startDay * CELL_W + 3}" y="13" font-size="8" fill="#475569" font-weight="600">${format(cur, "MMM yyyy")}</text>`
    );
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const todayDay = Math.ceil((today.getTime() - projectStart.getTime()) / 86400000);
  const todayLine = today >= projectStart && today <= projectEnd
    ? `<line x1="${LABEL_W + todayDay * CELL_W}" y1="0" x2="${LABEL_W + todayDay * CELL_W}" y2="9999" stroke="#ef4444" stroke-width="1" stroke-dasharray="3,2"/>`
    : "";

  const svgRows: string[] = [];
  let yOff = HEADER_H;
  let rowIdx = 0;
  for (const [phase, phaseTasks] of Array.from(phases.entries())) {
    const done = phaseTasks.filter(t => t.status === "DONE").length;
    const pct = Math.round((done / phaseTasks.length) * 100);
    svgRows.push(
      `<rect x="0" y="${yOff}" width="${svgW}" height="16" fill="#e2e8f0"/>`,
      `<text x="6" y="${yOff + 11}" font-size="9" fill="#334155" font-weight="700">${phase} (${phaseTasks.length} · ${pct}%)</text>`
    );
    yOff += 16;
    for (const task of phaseTasks) {
      const sd = parseD(task.startDate);
      const ed = parseD(task.endDate);
      const startDay = sd ? Math.max(0, Math.ceil((sd.getTime() - projectStart.getTime()) / 86400000)) : 0;
      const dur = task.durationDays || (sd && ed ? Math.ceil((ed.getTime() - sd.getTime()) / 86400000) + 1 : 1);
      const barW = Math.max(dur * CELL_W, CELL_W);
      const barX = LABEL_W + startDay * CELL_W;
      const color = task.status === "DONE" ? "#22c55e" : task.status === "IN_PROGRESS" ? "#3b82f6" : task.status === "BLOCKED" ? "#f97316" : "#C9A84C";
      const label = task.name.length > 30 ? task.name.slice(0, 30) + "…" : task.name;
      const bg = rowIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
      svgRows.push(
        `<rect x="0" y="${yOff}" width="${svgW}" height="${ROW_H}" fill="${bg}"/>`,
        `<line x1="0" y1="${yOff + ROW_H}" x2="${svgW}" y2="${yOff + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`,
        `<text x="${task.parentId ? 14 : 6}" y="${yOff + 12}" font-size="9" fill="#1e293b">${task.parentId ? "↳ " : ""}${label}</text>`,
        task.isMilestone
          ? `<polygon points="${barX},${yOff + 3} ${barX + 7},${yOff + ROW_H / 2} ${barX},${yOff + ROW_H - 3} ${barX - 7},${yOff + ROW_H / 2}" fill="#7c3aed"/>`
          : `<rect x="${barX}" y="${yOff + 4}" width="${barW}" height="${ROW_H - 8}" rx="2" fill="${color}" opacity="0.85"/>` +
            (task.percentComplete > 0 ? `<rect x="${barX}" y="${yOff + 4}" width="${(barW * task.percentComplete) / 100}" height="${ROW_H - 8}" rx="2" fill="${color}"/>` : "")
      );
      yOff += ROW_H;
      rowIdx++;
    }
  }
  const svgH = yOff + 24;
  const legendItems = [
    { color: "#3b82f6", label: "In Progress" }, { color: "#22c55e", label: "Done" },
    { color: "#f97316", label: "Blocked" }, { color: "#C9A84C", label: "Not Started" },
    { color: "#7c3aed", label: "Milestone" }, { color: "#ef4444", label: "Today" },
  ];
  const legendSvg = legendItems.map((item, i) =>
    `<rect x="${i * 100}" y="0" width="10" height="10" fill="${item.color}" rx="2"/><text x="${i * 100 + 13}" y="9" font-size="9" fill="#64748b">${item.label}</text>`
  ).join("");

  const doneTasks = tasks.filter(t => t.status === "DONE").length;
  const lateTasks = tasks.filter(t => t.status !== "DONE" && parseD(t.endDate) && parseD(t.endDate)! < today).length;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${clientName} — Schedule</title><style>
    body{font-family:system-ui,sans-serif;padding:20px 24px;color:#1e293b}
    h1{font-size:18px;margin:0 0 2px;color:#0f172a}.sub{font-size:11px;color:#64748b;margin-bottom:12px}
    .stats{display:flex;gap:24px;margin-bottom:16px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px}
    .stat{text-align:center}.sv{font-size:20px;font-weight:700;line-height:1;color:#0f172a}.late{color:#dc2626}
    .sl{font-size:10px;color:#64748b;margin-top:2px}.scroll{overflow-x:auto}svg{display:block}
    @media print{.no-print{display:none}@page{size:landscape;margin:0.5in}}
  </style></head><body>
  <h1>${clientName} — Schedule</h1>
  <p class="sub">Printed ${format(today, "MMMM d, yyyy")} · ${tasks.length} tasks · Start: ${format(projectStart, "MMM d, yyyy")}</p>
  <div class="stats">
    <div class="stat"><div class="sv">${tasks.length}</div><div class="sl">Total</div></div>
    <div class="stat"><div class="sv">${doneTasks}</div><div class="sl">Done</div></div>
    <div class="stat"><div class="sv ${lateTasks > 0 ? "late" : ""}">${lateTasks}</div><div class="sl">Late</div></div>
    <div class="stat"><div class="sv">${tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0}%</div><div class="sl">Complete</div></div>
  </div>
  <button class="no-print" onclick="window.print()" style="margin-bottom:14px;padding:6px 16px;background:#1e293b;color:white;border:none;border-radius:5px;font-size:12px;cursor:pointer">Print / Save as PDF</button>
  <div class="scroll">
  <svg width="${svgW}" height="${svgH}">${monthHeaders.join("")}${todayLine}${svgRows.join("")}<g transform="translate(${LABEL_W + 4},${svgH - 12})">${legendSvg}</g></svg>
  </div></body></html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function ClientScheduleTab({ companyId, clientId, clientName, initialTasks, canEdit }: {
  companyId: string; clientId: string; clientName: string; initialTasks: ClientTask[]; canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<ClientTask[]>(initialTasks);
  const historyRef = useRef<ClientTask[][]>([initialTasks]);
  const historyIdxRef = useRef(0);
  const isTimeTravelRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function commitTasks(newTasks: ClientTask[]) {
    if (isTimeTravelRef.current) { setTasks(newTasks); return; }
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(newTasks);
    if (historyRef.current.length > 30) historyRef.current = historyRef.current.slice(historyRef.current.length - 30);
    historyIdxRef.current = historyRef.current.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
    setTasks(newTasks);
  }

  async function applySnapshot(snapshot: ClientTask[], current: ClientTask[]) {
    isTimeTravelRef.current = true;
    setTasks(snapshot);
    isTimeTravelRef.current = false;
    const curMap = new Map(current.map(t => [t.id, t]));
    const patches = snapshot.filter(t => {
      const old = curMap.get(t.id);
      return old && (old.startDate !== t.startDate || old.endDate !== t.endDate || old.durationDays !== t.durationDays || old.status !== t.status || old.percentComplete !== t.percentComplete || old.phase !== t.phase || old.name !== t.name);
    });
    await Promise.all(patches.map(t =>
      fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: t.startDate, endDate: t.endDate, durationDays: t.durationDays, status: t.status, percentComplete: t.percentComplete, phase: t.phase, name: t.name }),
      })
    ));
  }

  async function undo() {
    if (historyIdxRef.current <= 0) return;
    const current = historyRef.current[historyIdxRef.current];
    historyIdxRef.current--;
    const snapshot = historyRef.current[historyIdxRef.current];
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
    await applySnapshot(snapshot, current);
  }

  async function redo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    const current = historyRef.current[historyIdxRef.current];
    historyIdxRef.current++;
    const snapshot = historyRef.current[historyIdxRef.current];
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
    await applySnapshot(snapshot, current);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const [adding, setAdding] = useState(false);
  const [addingPhase, setAddingPhase] = useState(false);
  const [assigningPhase, setAssigningPhase] = useState<ClientTask | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState<"save" | "saveas" | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [savedTemplateName, setSavedTemplateName] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [shiftingStart, setShiftingStart] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "gantt">("table");

  const phases = useMemo(() => Array.from(new Set(tasks.map(t => t.phase))), [tasks]);

  const scheduleStartDate = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.startDate)]).filter(Boolean) as Date[];
    if (!dates.length) return null;
    return dates.reduce((min, d) => d < min ? d : min, dates[0]);
  }, [tasks]);

  const scheduleEndDate = useMemo(() => {
    const dates = tasks.flatMap(t => [parseDate(t.endDate)]).filter(Boolean) as Date[];
    if (!dates.length) return null;
    return dates.reduce((max, d) => d > max ? d : max, dates[0]);
  }, [tasks]);

  const projectStart = useMemo(() => {
    return scheduleStartDate ? addDays(scheduleStartDate, -2) : new Date();
  }, [scheduleStartDate]);

  async function handleShiftStart(newStartStr: string) {
    if (!scheduleStartDate || !newStartStr) return;
    const newStart = parseDate(newStartStr);
    if (!newStart) return;
    const deltaDays = Math.round((newStart.getTime() - scheduleStartDate.getTime()) / 86400000);
    if (deltaDays === 0) return;
    setShiftingStart(true);
    const updated = tasks.map(t => {
      const s = parseDate(t.startDate);
      const e = parseDate(t.endDate);
      return {
        ...t,
        startDate: s ? toDateStr(addDays(s, deltaDays)) : t.startDate,
        endDate: e ? toDateStr(addDays(e, deltaDays)) : t.endDate,
      };
    });
    commitTasks(updated);
    await Promise.all(updated.map(t =>
      fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: t.startDate, endDate: t.endDate }),
      })
    ));
    setShiftingStart(false);
  }

  const done = tasks.filter(t => t.status === "DONE").length;
  const inProgress = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const blocked = tasks.filter(t => t.status === "BLOCKED").length;
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickSaved, setQuickSaved] = useState(false);

  async function handleQuickSave() {
    if (!savedTemplateId) { setSavingTemplate("saveas"); return; }
    setQuickSaving(true);
    const taskPayload = tasks.map(t => ({
      phase: t.phase, name: t.name, durationDays: t.durationDays, offsetDays: 0,
      trade: t.trade, assignee: t.assignee, isMilestone: t.isMilestone,
      parentId: t.parentId, predecessorIds: t.predecessorIds, sortOrder: t.sortOrder, notes: t.notes,
    }));
    await fetch(`/api/${companyId}/schedule-templates/${savedTemplateId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: savedTemplateName, tasks: taskPayload }),
    });
    setQuickSaving(false);
    setQuickSaved(true);
    setTimeout(() => setQuickSaved(false), 2000);
  }

  async function handleDeleteAll() {
    await Promise.all(tasks.map(t =>
      fetch(`/api/${companyId}/clients/${clientId}/schedule/${t.id}`, { method: "DELETE" })
    ));
    commitTasks([]);
  }

  return (
    <div className="space-y-4">
      {/* Start / End date bar */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: "#8b949e" }}>Start</span>
          {canEdit ? (
            <input
              type="date"
              value={scheduleStartDate ? toDateStr(scheduleStartDate) : ""}
              onChange={e => handleShiftStart(e.target.value)}
              disabled={shiftingStart || tasks.length === 0}
              className="outline-none rounded-lg px-2 py-1 text-sm font-semibold"
              style={{ background: "#0d1117", border: "1px solid #C9A84C55", color: "#C9A84C", colorScheme: "dark", minWidth: 130 }}
            />
          ) : (
            <span className="text-sm font-semibold" style={{ color: "#C9A84C" }}>
              {scheduleStartDate ? format(scheduleStartDate, "MMM d, yyyy") : "—"}
            </span>
          )}
          {shiftingStart && <span className="text-xs" style={{ color: "#8b949e" }}>Shifting…</span>}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-widest shrink-0" style={{ color: "#8b949e" }}>End</span>
          <span className="text-sm font-semibold" style={{ color: scheduleEndDate ? "#22c55e" : "#484f58" }}>
            {scheduleEndDate ? format(scheduleEndDate, "MMM d, yyyy") : "—"}
          </span>
          {scheduleStartDate && scheduleEndDate && (
            <span className="text-xs ml-1" style={{ color: "#484f58" }}>
              ({Math.ceil((scheduleEndDate.getTime() - scheduleStartDate.getTime()) / 86400000)} days)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: "#e6edf3" }}>Schedule</h2>
          {tasks.length > 0 && (
            <div className="flex gap-4 mt-1">
              <span className="text-xs" style={{ color: "#8b949e" }}>Total: <strong style={{ color: "#e6edf3" }}>{tasks.length}</strong></span>
              <span className="text-xs" style={{ color: "#8b949e" }}>Done: <strong style={{ color: "#22c55e" }}>{done}</strong></span>
              {inProgress > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>In progress: <strong style={{ color: "#3b82f6" }}>{inProgress}</strong></span>}
              {blocked > 0 && <span className="text-xs" style={{ color: "#8b949e" }}>Blocked: <strong style={{ color: "#f97316" }}>{blocked}</strong></span>}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Undo / Redo */}
          {canEdit && (
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
              <button
                onClick={undo} disabled={!canUndo}
                title="Undo (⌘Z)"
                className="text-xs font-semibold px-3 py-1.5 transition-colors"
                style={{ background: "#1e2736", color: canUndo ? "#e6edf3" : "#484f58", cursor: canUndo ? "pointer" : "not-allowed" }}
              >
                ↩ Undo
              </button>
              <button
                onClick={redo} disabled={!canRedo}
                title="Redo (⌘Y)"
                className="text-xs font-semibold px-3 py-1.5 transition-colors"
                style={{ background: "#1e2736", color: canRedo ? "#e6edf3" : "#484f58", cursor: canRedo ? "pointer" : "not-allowed", borderLeft: "1px solid #30373f" }}
              >
                ↪ Redo
              </button>
            </div>
          )}
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30373f" }}>
            <button
              onClick={() => setViewMode("table")}
              className="text-xs font-semibold px-3 py-1.5"
              style={{ background: viewMode === "table" ? GOLD : "#1e2736", color: viewMode === "table" ? "#0d1117" : "#8b949e" }}
            >
              ☰ Table
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className="text-xs font-semibold px-3 py-1.5"
              style={{ background: viewMode === "gantt" ? GOLD : "#1e2736", color: viewMode === "gantt" ? "#0d1117" : "#8b949e", borderLeft: "1px solid #30373f" }}
            >
              📊 Gantt
            </button>
          </div>
          {tasks.length > 0 && (
            <>
              {viewMode === "gantt" && (
                <>
                  <button
                    onClick={() => setCollapsed(new Set(phases))}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
                  >
                    ▶ Collapse All
                  </button>
                  <button
                    onClick={() => setCollapsed(new Set())}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
                  >
                    ▼ Expand All
                  </button>
                  <button
                    onClick={() => printGanttDiagram(tasks, projectStart, clientName)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
                    title="Preview and print the Gantt diagram"
                  >
                    🖨 Print Diagram
                  </button>
                </>
              )}
              <button
                onClick={() => printScheduleHtml(tasks)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}
                title="Print or save as PDF"
              >
                🖨 Print / PDF
              </button>
            </>
          )}
          {canEdit && (
            <>
              <button onClick={() => setLoadingTemplate(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}>
                📋 Load Template
              </button>
              {tasks.length > 0 && (
                <button onClick={handleDeleteAll} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "#2d1a1a", border: "1px solid #f8514933", color: "#f85149" }}>
                  🗑 Clear All
                </button>
              )}
              {tasks.length > 0 && (
                <>
                  <button onClick={handleQuickSave} disabled={quickSaving} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: quickSaved ? "#162312" : "#1e2736", border: `1px solid ${quickSaved ? "#22c55e55" : "#30373f"}`, color: quickSaved ? "#22c55e" : "#8b949e" }}>
                    {quickSaved ? "✓ Saved" : quickSaving ? "Saving…" : `💾 Save${savedTemplateId && savedTemplateName ? ` "${savedTemplateName}"` : ""}`}
                  </button>
                  <button onClick={() => setSavingTemplate("saveas")} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "#1e2736", border: "1px solid #30373f", color: "#8b949e" }}>
                    💾 Save As…
                  </button>
                </>
              )}
              <button onClick={() => setAddingPhase(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: "#1e2736", border: `1px solid ${GOLD}`, color: GOLD }}>
                + Add Phase
              </button>
              <button onClick={() => setAdding(true)} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: GOLD, color: "#0d1117" }}>
                + Add Task
              </button>
            </>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-xl" style={{ border: "1px solid #30373f", color: "#484f58" }}>
          <p className="text-2xl mb-2">📅</p>
          <p className="text-sm font-medium mb-1" style={{ color: "#8b949e" }}>No schedule yet</p>
          {canEdit && (
            <p className="text-xs">
              Click <strong style={{ color: GOLD }}>Load Template</strong> to start from a preset, or <strong style={{ color: GOLD }}>+ Add Task</strong> to build manually.
            </p>
          )}
        </div>
      ) : viewMode === "table" ? (
        <ScheduleTableView tasks={tasks} companyId={companyId} clientId={clientId} onTasksChange={commitTasks} canEdit={canEdit} />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <ClientGanttChart tasks={tasks} projectStart={projectStart} companyId={companyId} clientId={clientId} canEdit={canEdit} onTasksChange={commitTasks} collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
      )}

      {adding && (
        <AddTaskModal
          companyId={companyId} clientId={clientId}
          phases={phases.length ? phases : ["Pre-Construction", "Construction", "Finishing"]}
          onCreate={task => { commitTasks([...tasks, task]); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}

      {addingPhase && (
        <AddTaskModal
          companyId={companyId} clientId={clientId}
          phases={phases.length ? phases : ["Pre-Construction", "Construction", "Finishing"]}
          defaultMode="phase"
          onCreate={task => { commitTasks([...tasks, task]); setAddingPhase(false); setAssigningPhase(task); }}
          onClose={() => setAddingPhase(false)}
        />
      )}

      {assigningPhase && (
        <AssignTasksModal phaseTask={assigningPhase} tasks={tasks} companyId={companyId} clientId={clientId}
          onAssigned={updated => { commitTasks(updated); setAssigningPhase(null); }}
          onClose={() => setAssigningPhase(null)} />
      )}

      {loadingTemplate && (
        <LoadTemplateModal
          companyId={companyId} clientId={clientId}
          onLoaded={(newTasks, tplId, tplName) => {
            commitTasks([...tasks, ...newTasks]);
            if (tplId) { setSavedTemplateId(tplId); setSavedTemplateName(tplName ?? null); }
            setLoadingTemplate(false);
          }}
          onClose={() => setLoadingTemplate(false)}
        />
      )}
      {savingTemplate && (
        <SaveScheduleModal
          companyId={companyId}
          tasks={tasks}
          existingId={savingTemplate === "save" ? (savedTemplateId ?? undefined) : undefined}
          existingName={savingTemplate === "save" ? (savedTemplateName ?? undefined) : undefined}
          onClose={() => setSavingTemplate(null)}
          onSaved={(id, name) => { setSavedTemplateId(id); setSavedTemplateName(name); setSavingTemplate(null); }}
        />
      )}
    </div>
  );
}
