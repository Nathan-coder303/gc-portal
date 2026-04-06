import fs from "fs";
import path from "path";

export type TermsPreset = { id: string; name: string; content: string };

const PRESETS: { id: string; name: string; file: string }[] = [
  { id: "roof", name: "Roof", file: "roof.txt" },
  { id: "roof2", name: "Roof 2", file: "roof2.txt" },
  { id: "addition", name: "Addition", file: "addition.txt" },
  { id: "bathroom", name: "Bathroom", file: "bathroom.txt" },
  { id: "kitchen", name: "Kitchen", file: "kitchen.txt" },
  { id: "retail", name: "Retail Build-Out (AIA-Style)", file: "retail.txt" },
];

export function getFileTermsPresets(): TermsPreset[] {
  return PRESETS.map(({ id, name, file }) => {
    try {
      const content = fs.readFileSync(
        path.join(process.cwd(), "public", "terms", file),
        "utf-8"
      );
      return { id, name, content: content.trim() };
    } catch {
      return { id, name, content: "" };
    }
  });
}
