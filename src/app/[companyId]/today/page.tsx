import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export default async function TodayPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#e6edf3" }}>
        Today&apos;s Tasks
      </h1>
      <p className="text-sm mb-8" style={{ color: "#8b949e" }}>
        {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </p>
      <div className="rounded-xl p-10 text-center flex flex-col items-center" style={{ background: "#161b22", border: "1px solid #30373f" }}>
        <Image
          src="/thank-you-hashem.png"
          alt="Thank you Hashem"
          width={300}
          height={300}
          className="w-48 h-48 sm:w-72 sm:h-72"
        />
      </div>
    </div>
  );
}
