import fs from "fs";
import path from "path";

export type TermsPreset = { id: string; name: string; content: string };

const PRESETS: { id: string; name: string; file: string }[] = [
  { id: "standard", name: "Standard", file: "standard.txt" },
  { id: "addition", name: "Addition", file: "addition.txt" },
  { id: "renovation", name: "Renovation", file: "renovation.txt" },
  { id: "new-construction", name: "New Construction", file: "new-construction.txt" },
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
