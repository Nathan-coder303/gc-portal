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

type ClientTask = {
  id: string;
  phase: string;
  name: string;
  durationDays: number;
  startDate: string | null;
  endDate: string | null;
  predecessorIds: string[];
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
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

// ── Schedule Templates ─────────────────────────────────────────────────────────

type TplTask = { phase: string; name: string; durationDays: number; offsetDays: number; trade?: string; isMilestone?: boolean };
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
    description: "Home addition · full schedule · ~169 days",
    tasks: [
      // Pre-Construction
      { phase: "Pre-Construction", name: "Demolition existing wood", durationDays: 3, offsetDays: 0 },
      { phase: "Pre-Construction", name: "Excavation", durationDays: 3, offsetDays: 3 },
      // Shell - Footings
      { phase: "Shell - Footings", name: "Forming", durationDays: 1, offsetDays: 0 },
      { phase: "Shell - Footings", name: "Footings Rebars Installation", durationDays: 3, offsetDays: 1, trade: "Concrete" },
      { phase: "Shell - Footings", name: "Footings Inspection", durationDays: 1, offsetDays: 4, isMilestone: true },
      { phase: "Shell - Footings", name: "Footings Pouring Concrete", durationDays: 1, offsetDays: 5, trade: "Concrete" },
      // Shell - 1st Lift
      { phase: "Shell - 1st Lift", name: "1st Lift Columns", durationDays: 4, offsetDays: 0, trade: "Concrete" },
      { phase: "Shell - 1st Lift", name: "1st Lift Blocks", durationDays: 4, offsetDays: 0, trade: "Masonry" },
      // Shell - Slab on Grade
      { phase: "Shell - Slab on Grade", name: "SOG Rebars Installation", durationDays: 4, offsetDays: 0, trade: "Concrete" },
      { phase: "Shell - Slab on Grade", name: "SOG Inspection", durationDays: 1, offsetDays: 4, isMilestone: true },
      { phase: "Shell - Slab on Grade", name: "SOG Pouring Concrete", durationDays: 1, offsetDays: 5, trade: "Concrete" },
      // Shell - Tie Beam
      { phase: "Shell - Tie Beam", name: "Tie Beam Rebars Installation", durationDays: 5, offsetDays: 0, trade: "Concrete" },
      { phase: "Shell - Tie Beam", name: "Tie Beam Rebars Inspection", durationDays: 1, offsetDays: 5, isMilestone: true },
      { phase: "Shell - Tie Beam", name: "Tie Beam Pouring Concrete", durationDays: 1, offsetDays: 6, trade: "Concrete" },
      // Shell - Trusses
      { phase: "Shell - Trusses", name: "Trusses Installation", durationDays: 10, offsetDays: 0, trade: "Framing" },
      { phase: "Shell - Trusses", name: "Plywood Sheathing", durationDays: 5, offsetDays: 10, trade: "Framing" },
      // Plumbing
      { phase: "Plumbing", name: "Plumbing Underground Installation", durationDays: 4, offsetDays: 0, trade: "Plumbing" },
      { phase: "Plumbing", name: "Plumbing Underground Inspection", durationDays: 1, offsetDays: 4, isMilestone: true },
      { phase: "Plumbing", name: "Plumbing Rough Installation", durationDays: 1, offsetDays: 5, trade: "Plumbing" },
      { phase: "Plumbing", name: "Plumbing Rough Inspection", durationDays: 1, offsetDays: 6, isMilestone: true },
      { phase: "Plumbing", name: "Toilets Installation", durationDays: 1, offsetDays: 7, trade: "Plumbing" },
      { phase: "Plumbing", name: "Vanity Installation", durationDays: 1, offsetDays: 8, trade: "Plumbing" },
      { phase: "Plumbing", name: "Bathtub Installation", durationDays: 1, offsetDays: 9, trade: "Plumbing" },
      { phase: "Plumbing", name: "Plumbing Final Inspection", durationDays: 1, offsetDays: 10, isMilestone: true },
      // Electrical
      { phase: "Electrical", name: "Electrical Underground", durationDays: 1, offsetDays: 0, trade: "Electrical" },
      { phase: "Electrical", name: "Electrical Rough", durationDays: 5, offsetDays: 1, trade: "Electrical" },
      { phase: "Electrical", name: "Electrical Rough Inspection", durationDays: 1, offsetDays: 6, isMilestone: true },
      { phase: "Electrical", name: "Electrical Trims and Outlets", durationDays: 4, offsetDays: 7, trade: "Electrical" },
      { phase: "Electrical", name: "Electrical Final Inspection", durationDays: 1, offsetDays: 11, isMilestone: true },
      // Roof
      { phase: "Roof", name: "Flat Roof Installation", durationDays: 5, offsetDays: 0, trade: "Roofing" },
      { phase: "Roof", name: "Flat Roof Final Inspection", durationDays: 1, offsetDays: 5, isMilestone: true },
      // Windows
      { phase: "Windows", name: "Windows Installation", durationDays: 3, offsetDays: 0, trade: "Windows" },
      { phase: "Windows", name: "Windows Inspection", durationDays: 1, offsetDays: 3, isMilestone: true },
      // Drywall
      { phase: "Drywall", name: "Wall Insulation", durationDays: 3, offsetDays: 0, trade: "Insulation" },
      { phase: "Drywall", name: "Roof Insulation", durationDays: 4, offsetDays: 0, trade: "Insulation" },
      { phase: "Drywall", name: "Insulation Inspection", durationDays: 1, offsetDays: 4, isMilestone: true },
      { phase: "Drywall", name: "Framing Installation", durationDays: 5, offsetDays: 5, trade: "Framing" },
      { phase: "Drywall", name: "Framing Inspection", durationDays: 1, offsetDays: 10, isMilestone: true },
      { phase: "Drywall", name: "Drywall Hanging", durationDays: 10, offsetDays: 11, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Inspection", durationDays: 1, offsetDays: 21, isMilestone: true },
      { phase: "Drywall", name: "Drywall Finish", durationDays: 7, offsetDays: 22, trade: "Drywall" },
      { phase: "Drywall", name: "Drywall Finishes Touchup", durationDays: 1, offsetDays: 29, trade: "Drywall" },
      { phase: "Drywall", name: "Ceilings Paint", durationDays: 3, offsetDays: 30, trade: "Painter" },
      { phase: "Drywall", name: "Wall Paint", durationDays: 7, offsetDays: 33, trade: "Painter" },
      // Tiles
      { phase: "Tiles", name: "Flooring Tiles", durationDays: 7, offsetDays: 0, trade: "Tile" },
      { phase: "Tiles", name: "Bathroom Wall Tiles", durationDays: 5, offsetDays: 0, trade: "Tile" },
      // Fine Carpentry
      { phase: "Fine Carpentry", name: "Baseboards Installation", durationDays: 10, offsetDays: 0, trade: "Carpenter" },
      { phase: "Fine Carpentry", name: "Doors Installation", durationDays: 3, offsetDays: 0, trade: "Carpenter" },
      { phase: "Fine Carpentry", name: "Doors Casings Installation", durationDays: 5, offsetDays: 3, trade: "Carpenter" },
      // Exterior
      { phase: "Exterior", name: "Stucco", durationDays: 60, offsetDays: 0, trade: "Stucco" },
      { phase: "Exterior", name: "Exterior Paint", durationDays: 60, offsetDays: 60, trade: "Painter" },
      // HVAC
      { phase: "HVAC", name: "HVAC Ducts Installation", durationDays: 3, offsetDays: 0, trade: "HVAC" },
      { phase: "HVAC", name: "HVAC Rough Inspection", durationDays: 1, offsetDays: 3, isMilestone: true },
      { phase: "HVAC", name: "HVAC Mini Split Installation", durationDays: 1, offsetDays: 4, trade: "HVAC" },
      { phase: "HVAC", name: "HVAC Final Inspection", durationDays: 1, offsetDays: 5, isMilestone: true },
      // Closeout
      { phase: "Closeout", name: "Final Cleaning", durationDays: 1, offsetDays: 0 },
      { phase: "Closeout", name: "Building Final Inspection", durationDays: 1, offsetDays: 1, isMilestone: true },
    ],
  },
];

// ── Load Template Modal ────────────────────────────────────────────────────────

function LoadTemplateModal({
  companyId,
  clientId,
  onLoaded,
  onClose,
}: {
  companyId: string;
  clientId: string;
  onLoaded: (tasks: ClientTask[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<ScheduleTemplate | null>(null);
  const [startDate, setStartDate] = useState(todayStr());
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    if (!selected) return;
    setLoading(true);
    const base = parseDate(startDate) ?? new Date();
    const created: ClientTask[] = [];
    for (const t of selected.tasks) {
      const start = addDays(base, t.offsetDays);
      const end = addDays(start, t.durationDays - 1);
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: t.phase,
          name: t.name,
          durationDays: t.durationDays,
          startDate: toDateStr(start),
          endDate: toDateStr(end),
          trade: t.trade ?? null,
          isMilestone: t.isMilestone ?? false,
        }),
      });
      const raw = await res.json();
      const task: ClientTask = {
        id: raw.id,
        phase: raw.phase ?? t.phase,
        name: raw.name ?? t.name,
        durationDays: raw.durationDays ?? t.durationDays,
        startDate: raw.startDate ?? null,
        endDate: raw.endDate ?? null,
        predecessorIds: raw.predecessorIds ?? [],
        parentId: raw.parentId ?? null,
        trade: raw.trade ?? t.trade ?? null,
        assignee: raw.assignee ?? null,
        isMilestone: raw.isMilestone ?? t.isMilestone ?? false,
        status: raw.status ?? "NOT_STARTED",
        percentComplete: raw.percentComplete ?? 0,
        notes: raw.notes ?? null,
        priority: raw.priority ?? null,
        actualFinish: raw.actualFinish ?? null,
        sortOrder: raw.sortOrder ?? 0,
      };
      created.push(task);
    }
    setLoading(false);
    onLoaded(created);
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

        {/* Template cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {SCHEDULE_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => setSelected(tpl)}
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

        {selected && (
          <>
            {/* Phase preview */}
            <div className="mb-4 rounded-xl p-3 text-xs" style={{ background: "#0d1117", border: "1px solid #30373f" }}>
              <div className="font-semibold mb-2" style={{ color: "#8b949e" }}>Phases: {Array.from(new Set(selected.tasks.map(t => t.phase))).join(" → ")}</div>
              <div className="flex flex-wrap gap-1">
                {selected.tasks.filter(t => t.isMilestone).map(t => (
                  <span key={t.name} className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: "#1e2736", color: "#7c3aed", border: "1px solid #7c3aed44" }}>◆ {t.name}</span>
                ))}
              </div>
            </div>

            {/* Start date */}
            <div className="mb-4">
              <label className="block text-xs mb-1 font-medium" style={{ color: "#8b949e" }}>Project Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ ...INPUT, width: 180 }} />
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button onClick={handleLoad} disabled={!selected || loading}
            className="flex-1 py-2 text-sm font-semibold rounded-xl disabled:opacity-50"
            style={{ background: GOLD, color: "#0d1117" }}>
            {loading ? `Loading… (${selected?.tasks.length} tasks)` : `Load ${selected?.label ?? "Template"}`}
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

function AddTaskModal({ companyId, clientId, phases, onCreate, onClose, defaultParentId, defaultParentName }: {
  companyId: string; clientId: string; phases: string[];
  onCreate: (task: ClientTask) => void; onClose: () => void;
  defaultParentId?: string; defaultParentName?: string;
}) {
  const [form, setForm] = useState({ name: "", phase: phases[0] ?? "General", durationDays: "5", startDate: todayStr(), trade: "", assignee: "" });
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const dur = Math.max(1, parseInt(form.durationDays) || 1);
    const start = form.startDate ? new Date(form.startDate + "T00:00:00") : new Date();
    const end = addDays(start, dur - 1);
    try {
      const res = await fetch(`/api/${companyId}/clients/${clientId}/schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), phase: form.phase.trim() || "General", durationDays: dur, startDate: toDateStr(start), endDate: toDateStr(end), trade: form.trade.trim() || null, assignee: form.assignee.trim() || null, parentId: defaultParentId ?? null }),
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
        <h3 className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>{defaultParentId ? "Add Sub-task" : "Add Task"}</h3>
        {defaultParentName && <p className="text-xs mb-4" style={{ color: "#8b949e" }}>Child of: <span style={{ color: GOLD }}>{defaultParentName}</span></p>}
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Task Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={INPUT} className="outline-none" autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
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
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleCreate} disabled={!form.name.trim() || saving} className="flex-1 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: GOLD, color: "#0d1117" }}>
            {saving ? "Adding…" : "Add Task"}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: ClientTask } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Track last click for double-click detection
  const lastClickRef = useRef<{ time: number; taskId: string } | null>(null);

  const toggle = (phase: string) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(phase)) next.delete(phase); else next.add(phase);
    return next;
  });

  const phases = useMemo(() => {
    const map = new Map<string, ClientTask[]>();
    for (const t of tasks) { const arr = map.get(t.phase) ?? []; arr.push(t); map.set(t.phase, arr); }
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
  const svgWidth = LABEL_WIDTH + totalDays * CELL_WIDTH;

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

          {/* Month headers */}
          {months.map(m => (
            <g key={m.label}>
              <rect x={LABEL_WIDTH + m.startDay * CELL_WIDTH} y={0} width={m.days * CELL_WIDTH} height={HEADER_H} fill="#161b22" stroke="#30373f" strokeWidth={0.5} />
              <text x={LABEL_WIDTH + m.startDay * CELL_WIDTH + 6} y={15} fontSize={10} fill="#8b949e" fontWeight={600}>{m.label}</text>
            </g>
          ))}

          {/* Weekend shading */}
          {Array.from({ length: totalDays }).map((_, d) => {
            const date = addDays(projectStart, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            return <rect key={d} x={LABEL_WIDTH + d * CELL_WIDTH} y={HEADER_H} width={CELL_WIDTH} height={svgHeight - HEADER_H - 30} fill={isWeekend ? "#0a0e14" : "transparent"} />;
          })}
          {Array.from({ length: totalDays }).map((_, d) => (
            <line key={`v${d}`} x1={LABEL_WIDTH + d * CELL_WIDTH} y1={HEADER_H} x2={LABEL_WIDTH + d * CELL_WIDTH} y2={svgHeight - 30} stroke="#30373f" strokeWidth={0.5} />
          ))}

          {/* Today line */}
          {today >= projectStart && today <= addDays(projectEnd, 8) && (() => {
            const x = LABEL_WIDTH + differenceInDays(today, projectStart) * CELL_WIDTH;
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
              const barX = LABEL_WIDTH + differenceInDays(phaseStart, projectStart) * CELL_WIDTH;
              const barW = Math.max((differenceInDays(phaseEnd, phaseStart) + 1) * CELL_WIDTH, CELL_WIDTH);
              const done = row.phaseTasks.filter(t => t.status === "DONE").length;
              const pct = Math.round((done / row.phaseTasks.length) * 100);
              return (
                <g key={row.phase} opacity={phaseOpacity}>
                  <rect x={0} y={y} width={svgWidth} height={PHASE_ROW_HEIGHT} fill="#161b22" />
                  <line x1={0} y1={y} x2={svgWidth} y2={y} stroke="#30373f" strokeWidth={0.5} />
                  {canEdit && <text x={4} y={y + 17} fontSize={10} fill="#484f58" style={{ cursor: "grab" }} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setPhaseDrag({ phase: row.phase, startClientY: e.clientY, currentClientY: e.clientY }); }}>⠿</text>}
                  <g onClick={() => toggle(row.phase)} style={{ cursor: "pointer" }}>
                    <rect x={canEdit ? 16 : 0} y={y} width={LABEL_WIDTH - (canEdit ? 16 : 0)} height={PHASE_ROW_HEIGHT} fill="transparent" />
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
            const barX = LABEL_WIDTH + startDay * CELL_WIDTH;
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
                        x={LABEL_WIDTH + differenceInDays(startDate, projectStart) * CELL_WIDTH}
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

          {/* Legend */}
          <g transform={`translate(${LABEL_WIDTH + 8}, ${svgHeight - 16})`}>
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
      {contextMenu && (
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 200, minWidth: 180, background: "#161b22", border: "1px solid #30373f", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.preventDefault()}
        >
          {/* Close on outside click */}
          <div style={{ position: "fixed", inset: 0, zIndex: -1 }} onClick={() => setContextMenu(null)} />
          {[
            { label: "✏️  Edit task", action: () => { setEditTask(contextMenu.task); setContextMenu(null); } },
            { label: "➕  Add sub-task", action: () => { setAddChildFor(contextMenu.task); setContextMenu(null); } },
            { label: "🔗  Set parent…", action: () => { setSetParentFor(contextMenu.task); setContextMenu(null); } },
            ...(contextMenu.task.parentId ? [{ label: "🔓  Remove parent", action: () => { handleSetParent(contextMenu.task, null); setContextMenu(null); } }] : []),
            { label: "⧉  Duplicate", action: () => { handleDuplicate(contextMenu.task); setContextMenu(null); } },
            { label: "🗑  Delete", action: () => { handleDeleteTask(contextMenu.task); setContextMenu(null); }, danger: true },
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
        </div>
      )}

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
      {setParentFor && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setSetParentFor(null)}>
          <div style={{ background: "#161b22", border: "1px solid #30373f", borderRadius: 14, padding: 20, width: "100%", maxWidth: 400, maxHeight: "70vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold mb-3" style={{ color: "#e6edf3" }}>
              Set parent for <span style={{ color: GOLD }}>{setParentFor.name}</span>
            </h3>
            <div className="space-y-1">
              {tasks.filter(t => t.id !== setParentFor.id && !t.parentId).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSetParent(setParentFor, t.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[#1e2736]"
                  style={{ color: "#e6edf3", background: setParentFor.parentId === t.id ? "#1e2736" : "transparent" }}
                >
                  {setParentFor.parentId === t.id ? "✓ " : ""}{t.name}
                  <span className="ml-2 text-[10px]" style={{ color: "#484f58" }}>{t.phase}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSetParentFor(null)} className="mt-3 text-xs w-full py-2 rounded-lg" style={{ background: "#30373f", color: "#8b949e" }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Edit Task Modal (for table view double-click) ─────────────────────────────

function EditTaskModal({
  task, companyId, clientId, onUpdate, onDelete, onClose,
}: {
  task: ClientTask; companyId: string; clientId: string;
  onUpdate: (updated: ClientTask) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: task.name,
    phase: task.phase,
    durationDays: String(task.durationDays),
    startDate: task.startDate ?? "",
    endDate: task.endDate ?? "",
    actualFinish: task.actualFinish ?? "",
    percentComplete: String(task.percentComplete),
    status: task.status,
    priority: task.priority ?? "",
    assignee: task.assignee ?? "",
    trade: task.trade ?? "",
    notes: task.notes ?? "",
    predecessorIds: task.predecessorIds.join(", "),
    isMilestone: task.isMilestone,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
      const updated = await res.json();
      onUpdate({ ...task, ...updated });
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
        <div className="flex items-center justify-between mb-4">
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
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Planned Start</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={INPUT} className="outline-none" />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: "#8b949e" }}>Planned End</label>
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

function ScheduleTableView({
  tasks, companyId, clientId, onTasksChange,
}: {
  tasks: ClientTask[];
  companyId: string;
  clientId: string;
  onTasksChange: (tasks: ClientTask[]) => void;
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editTask, setEditTask] = useState<ClientTask | null>(null);

  const rows = useMemo(() => buildTableRows(tasks, collapsedIds), [tasks, collapsedIds]);

  // Build rowNum→task id map for predecessor display
  const idToRowNum = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.task.id, r.rowNum);
    return map;
  }, [rows]);

  function toggleCollapse(id: string) {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function statusLabel(s: string) {
    const map: Record<string, string> = { NOT_STARTED: "To Do", IN_PROGRESS: "In Progress", DONE: "Done", BLOCKED: "Blocked" };
    return map[s] ?? s;
  }

  function statusColor(s: string) {
    const map: Record<string, string> = { NOT_STARTED: GOLD, IN_PROGRESS: "#3b82f6", DONE: "#22c55e", BLOCKED: "#f97316" };
    return map[s] ?? "#8b949e";
  }

  function priorityColor(p: string | null) {
    if (p === "HIGH") return "#f87171";
    if (p === "MEDIUM") return GOLD;
    if (p === "LOW") return "#22c55e";
    return "#8b949e";
  }

  const colStyle = (width: number): React.CSSProperties => ({
    minWidth: width,
    maxWidth: width,
    padding: "0 8px",
    borderRight: "1px solid #21262d",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 12,
    color: "#e6edf3",
    height: 36,
    display: "table-cell",
    verticalAlign: "middle",
  });

  const thStyle = (width: number): React.CSSProperties => ({
    ...colStyle(width),
    background: "#161b22",
    color: "#8b949e",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    height: 32,
    position: "sticky",
    top: 0,
    zIndex: 2,
  });

  return (
    <>
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "70vh", borderRadius: 8, border: "1px solid #21262d" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1200, tableLayout: "fixed", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ ...thStyle(40), position: "sticky", left: 0, zIndex: 3, background: "#161b22" }}>#</th>
              <th style={thStyle(70)} title="Finish-to-Start: this task cannot start until the linked tasks are finished">LINKED FROM</th>
              <th style={thStyle(70)}>WBS</th>
              <th style={{ ...thStyle(240), textAlign: "left" }}>TASK NAME</th>
              <th style={thStyle(80)}>DURATION</th>
              <th style={thStyle(50)}>%</th>
              <th style={thStyle(100)}>PLANNED START</th>
              <th style={thStyle(100)}>PLANNED END</th>
              <th style={thStyle(100)}>ACTUAL FINISH</th>
              <th style={thStyle(80)}>PRIORITY</th>
              <th style={thStyle(100)}>STATUS</th>
              <th style={{ ...thStyle(110), borderRight: "none" }}>ASSIGNEE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const { task, rowNum: rn, depth, wbs, hasChildren } = r;
              const isParentRow = hasChildren;
              const rowBg = isParentRow ? "#1e2736" : rn % 2 === 0 ? "#0d1117" : "#0a0e14";
              const linkStr = task.predecessorIds
                .map(pid => idToRowNum.get(pid))
                .filter(Boolean)
                .join(", ");

              return (
                <tr
                  key={task.id}
                  onDoubleClick={() => setEditTask(task)}
                  style={{ background: rowBg, cursor: "pointer" }}
                  className="hover:brightness-110"
                >
                  {/* # — sticky */}
                  <td style={{ ...colStyle(40), position: "sticky", left: 0, background: rowBg, zIndex: 1, color: "#484f58", textAlign: "center" }}>
                    {rn}
                  </td>
                  {/* LINK */}
                  <td style={{ ...colStyle(60), color: "#8b949e", textAlign: "center" }}>
                    {linkStr}
                  </td>
                  {/* WBS */}
                  <td style={{ ...colStyle(70), color: "#8b949e" }}>
                    {wbs}
                  </td>
                  {/* TASK NAME */}
                  <td style={{ ...colStyle(240), paddingLeft: 8 + depth * 16, fontWeight: isParentRow ? 700 : 400, color: isParentRow ? GOLD : task.status === "DONE" ? "#484f58" : "#e6edf3" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "100%", overflow: "hidden" }}>
                      {hasChildren && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#8b949e", padding: 0, fontSize: 12, flexShrink: 0 }}
                        >
                          {collapsedIds.has(task.id) ? "⊞" : "⊟"}
                        </button>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.isMilestone ? "◆ " : ""}{task.name}
                      </span>
                    </span>
                  </td>
                  {/* DURATION */}
                  <td style={{ ...colStyle(80), textAlign: "center", color: "#8b949e" }}>
                    {task.durationDays === 1 ? "1 day" : `${task.durationDays} days`}
                  </td>
                  {/* % */}
                  <td style={{ ...colStyle(50), textAlign: "center", color: task.percentComplete === 100 ? "#22c55e" : "#e6edf3" }}>
                    {task.percentComplete}%
                  </td>
                  {/* PLANNED START */}
                  <td style={{ ...colStyle(100), color: "#8b949e" }}>
                    {fmtDate(task.startDate)}
                  </td>
                  {/* PLANNED END */}
                  <td style={{ ...colStyle(100), color: "#8b949e" }}>
                    {fmtDate(task.endDate)}
                  </td>
                  {/* ACTUAL FINISH */}
                  <td style={{ ...colStyle(100), color: task.actualFinish ? "#22c55e" : "#484f58" }}>
                    {fmtDate(task.actualFinish)}
                  </td>
                  {/* PRIORITY */}
                  <td style={{ ...colStyle(80), color: priorityColor(task.priority), fontWeight: task.priority ? 600 : 400, textAlign: "center" }}>
                    {task.priority ?? ""}
                  </td>
                  {/* STATUS */}
                  <td style={{ ...colStyle(100), color: statusColor(task.status) }}>
                    {statusLabel(task.status)}
                  </td>
                  {/* ASSIGNEE */}
                  <td style={{ ...colStyle(110), color: "#8b949e", borderRight: "none" }}>
                    {task.assignee ? (task.assignee.length > 14 ? task.assignee.slice(0, 14) + "…" : task.assignee) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editTask && (
        <EditTaskModal
          task={editTask}
          companyId={companyId}
          clientId={clientId}
          onUpdate={updated => { onTasksChange(tasks.map(t => t.id === updated.id ? updated : t)); setEditTask(null); }}
          onDelete={id => { onTasksChange(tasks.filter(t => t.id !== id)); setEditTask(null); }}
          onClose={() => setEditTask(null)}
        />
      )}
    </>
  );
}

// ── Main Tab ───────────────────────────────────────────────────────────────────

function printScheduleHtml(tasks: ClientTask[]) {
  const phases = Array.from(new Set(tasks.map(t => t.phase)));
  const rows = phases.flatMap(phase => {
    const phaseTasks = tasks.filter(t => t.phase === phase);
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

export default function ClientScheduleTab({ companyId, clientId, initialTasks, canEdit }: {
  companyId: string; clientId: string; initialTasks: ClientTask[]; canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<ClientTask[]>(initialTasks);
  const [adding, setAdding] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
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
    setTasks(updated);
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
        <ScheduleTableView tasks={tasks} companyId={companyId} clientId={clientId} onTasksChange={setTasks} />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #30373f" }}>
          <ClientGanttChart tasks={tasks} projectStart={projectStart} companyId={companyId} clientId={clientId} canEdit={canEdit} onTasksChange={setTasks} collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
      )}

      {adding && (
        <AddTaskModal
          companyId={companyId} clientId={clientId}
          phases={phases.length ? phases : ["Pre-Construction", "Construction", "Finishing"]}
          onCreate={task => { setTasks(prev => [...prev, task]); setAdding(false); }}
          onClose={() => setAdding(false)}
        />
      )}

      {loadingTemplate && (
        <LoadTemplateModal
          companyId={companyId} clientId={clientId}
          onLoaded={newTasks => { setTasks(prev => [...prev, ...newTasks]); setLoadingTemplate(false); }}
          onClose={() => setLoadingTemplate(false)}
        />
      )}
    </div>
  );
}
