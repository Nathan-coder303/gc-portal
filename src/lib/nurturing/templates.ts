export type NurturingTemplate = {
  id: string;          // e.g. "roof-1-contract-signed"
  type: "roof" | "addition";
  step: number;
  name: string;
  subject: string;
  body: string;        // plain text with [Client Name] / [Company Name] placeholders
};

const ROOF: NurturingTemplate[] = [
  {
    id: "roof-1-contract-signed",
    type: "roof",
    step: 1,
    name: "Contract Signed / Onboarding",
    subject: "Welcome – Your Roofing Project Has Begun",
    body: `Hi [Client Name],

We're excited to get started on your roofing project.

Here's what happens next:
• We are preparing and submitting your permit
• Material selections will be finalized (if not already)
• We'll keep you updated at every stage

Your project manager: [PM Name + Phone]

You'll receive updates as we move through each milestone.
We're committed to making this smooth and stress-free.

Best,
[Company Name]`,
  },
  {
    id: "roof-2-permit-submitted",
    type: "roof",
    step: 2,
    name: "Permit Submitted",
    subject: "Update: Permit Submitted",
    body: `Hi [Client Name],

Your roofing permit has officially been submitted to the city.

⏱ Typical approval time: varies by municipality

At this stage:
• We are waiting on city approval
• No action is required from you

We will notify you immediately once it is approved and schedule your installation.

Thank you for your patience,
[Company Name]`,
  },
  {
    id: "roof-3-permit-approved",
    type: "roof",
    step: 3,
    name: "Permit Approved",
    subject: "Good News: Permit Approved",
    body: `Hi [Client Name],

Great news — your permit has been approved.

Next steps:
• We are scheduling your project start date
• Materials will be prepared and delivered

You will receive your official start date shortly.
We're getting closer!

Best,
[Company Name]`,
  },
  {
    id: "roof-4-project-scheduled",
    type: "roof",
    step: 4,
    name: "Project Scheduled",
    subject: "Your Project is Scheduled",
    body: `Hi [Client Name],

Your roofing project is scheduled to begin on:

📅 Start Date: [Date]

What to expect:
• Crew arrival between [time window]
• Noise during working hours
• Please move vehicles away from driveway

We will take all precautions to protect your property.
If you have any concerns before start day, feel free to reach out.

Best,
[Company Name]`,
  },
  {
    id: "roof-5-first-day",
    type: "roof",
    step: 5,
    name: "First Day of Work",
    subject: "We've Started Your Project",
    body: `Hi [Client Name],

Work on your roof has officially begun today.

Today's focus:
• Tear-off / preparation phase
• Initial installation steps

Our team will keep the site clean and safe throughout the process.
We'll keep you updated as we move forward.

Best,
[Company Name]`,
  },
  {
    id: "roof-6-first-inspection",
    type: "roof",
    step: 6,
    name: "First Inspection (Dry-In)",
    subject: "Inspection Update",
    body: `Hi [Client Name],

Your project has reached its first inspection stage.

Status:
• Inspection type: Dry-in / Underlayment
• Result: [Passed / Scheduled]

Once approved, we proceed to the next installation phase.
We'll keep things moving efficiently.

Best,
[Company Name]`,
  },
  {
    id: "roof-7-mid-project-update",
    type: "roof",
    step: 7,
    name: "Mid-Project Progress Update",
    subject: "Project Progress Update",
    body: `Hi [Client Name],

Your roofing project is progressing well.

Current stage:
• Installation in progress

What's next:
• Final installation steps
• Preparation for final inspection

We appreciate your cooperation during the process.

Best,
[Company Name]`,
  },
  {
    id: "roof-8-second-inspection",
    type: "roof",
    step: 8,
    name: "Second Inspection",
    subject: "Inspection Update",
    body: `Hi [Client Name],

We've reached another inspection milestone.

Status:
• Inspection type: [Specify]
• Result: [Passed / Scheduled]

We're moving steadily toward completion.

Best,
[Company Name]`,
  },
  {
    id: "roof-9-work-completed",
    type: "roof",
    step: 9,
    name: "Work Completed (Before Final Inspection)",
    subject: "Work Completed – Final Steps Remaining",
    body: `Hi [Client Name],

Your roofing installation is now complete.

Next steps:
• Final inspection with the city
• Final cleanup and walkthrough

Your property has been cleaned, and we've performed a quality check.
We'll notify you once the final inspection is completed.

Best,
[Company Name]`,
  },
  {
    id: "roof-10-permit-closed",
    type: "roof",
    step: 10,
    name: "Final Inspection + Permit Closed",
    subject: "Project Complete – Permit Closed",
    body: `Hi [Client Name],

We're happy to inform you that your project has passed final inspection and the permit is now officially closed.

Your roof is now fully completed and compliant.

Documents:
• Final inspection approval
• Warranty information

Thank you for trusting us with your home.

Best,
[Company Name]`,
  },
  {
    id: "roof-11-review-request",
    type: "roof",
    step: 11,
    name: "Review Request",
    subject: "Quick Favor – Your Feedback",
    body: `Hi [Client Name],

It was a pleasure working with you.

If you're happy with the results, we'd greatly appreciate a quick review:
[Google Review Link]

Your feedback helps other homeowners feel confident choosing us.

Thank you again,
[Company Name]`,
  },
  {
    id: "roof-12-warranty-followup",
    type: "roof",
    step: 12,
    name: "Warranty & Maintenance Follow-Up",
    subject: "Your Roof – Care & Warranty Reminder",
    body: `Hi [Client Name],

Just checking in after your project completion.

Reminder:
• Your roof is under warranty
• Regular maintenance helps extend its lifespan

If you ever need anything, we're here.

Best,
[Company Name]`,
  },
];

const ADDITION: NurturingTemplate[] = [
  {
    id: "addition-1-contract-signed",
    type: "addition",
    step: 1,
    name: "Contract Signed / Kickoff",
    subject: "Welcome – Your Addition Project Has Begun",
    body: `Hi [Client Name],

We're excited to begin your home addition project.

Here's what happens next:
• Architectural plans will be finalized
• Engineering review (if required)
• Permit preparation and submission

Your project manager: [PM Name + Phone]

We will guide you through every step.

Best,
[Company Name]`,
  },
  {
    id: "addition-2-design-phase",
    type: "addition",
    step: 2,
    name: "Design & Architecture Phase",
    subject: "Design Phase in Progress",
    body: `Hi [Client Name],

We are currently finalizing your project plans.

This includes:
• Architectural drawings
• Layout and dimensions
• Initial structural considerations

Next step:
• Engineering review and adjustments

We will notify you once plans are ready for submission.

Best,
[Company Name]`,
  },
  {
    id: "addition-3-engineering-review",
    type: "addition",
    step: 3,
    name: "Engineering Review",
    subject: "Engineering Phase Update",
    body: `Hi [Client Name],

Your project is now in the engineering phase.

This stage ensures:
• Structural integrity
• Compliance with building codes
• Load calculations and reinforcements

Once complete, we will proceed to permit submission.

Best,
[Company Name]`,
  },
  {
    id: "addition-4-permit-submitted",
    type: "addition",
    step: 4,
    name: "Permit Submitted",
    subject: "Permit Submitted",
    body: `Hi [Client Name],

Your permit application has been submitted.

⏱ Estimated approval timeline: varies by city

At this stage:
• We are waiting on city review
• Revisions may be requested by the city

We'll keep you updated throughout.

Best,
[Company Name]`,
  },
  {
    id: "addition-5-permit-revisions",
    type: "addition",
    step: 5,
    name: "Permit Revisions (If Required)",
    subject: "Permit Revision Update",
    body: `Hi [Client Name],

The city has requested revisions to your permit.
This is a normal part of the process.

We are:
• Addressing all requested changes
• Coordinating with architect/engineer

We'll resubmit promptly and keep things moving.

Best,
[Company Name]`,
  },
  {
    id: "addition-6-permit-approved",
    type: "addition",
    step: 6,
    name: "Permit Approved",
    subject: "Permit Approved – Moving Forward",
    body: `Hi [Client Name],

Great news — your permit has been approved.

Next steps:
• Scheduling your project start
• Ordering materials
• Preparing site logistics

We will confirm your start date shortly.

Best,
[Company Name]`,
  },
  {
    id: "addition-7-preconstruction-meeting",
    type: "addition",
    step: 7,
    name: "Pre-Construction Meeting",
    subject: "Pre-Construction Meeting",
    body: `Hi [Client Name],

Before we begin, we will schedule a pre-construction meeting.

We'll review:
• Project timeline
• Site access and logistics
• Safety and working hours

This ensures everything runs smoothly from day one.

Best,
[Company Name]`,
  },
  {
    id: "addition-8-project-start",
    type: "addition",
    step: 8,
    name: "Project Start (Site Prep & Demo)",
    subject: "Construction Has Started",
    body: `Hi [Client Name],

Your project has officially begun.

Current phase:
• Site preparation and/or demolition

What to expect:
• Noise and activity during working hours
• Equipment on site

We will maintain a clean and safe job site.

Best,
[Company Name]`,
  },
  {
    id: "addition-9-foundation-work",
    type: "addition",
    step: 9,
    name: "Foundation Work",
    subject: "Foundation Phase Update",
    body: `Hi [Client Name],

We are now working on the foundation.

This includes:
• Excavation
• Footings and concrete work

Next:
• Foundation inspection before framing

Best,
[Company Name]`,
  },
  {
    id: "addition-10-foundation-inspection",
    type: "addition",
    step: 10,
    name: "Foundation Inspection",
    subject: "Inspection Update – Foundation",
    body: `Hi [Client Name],

Your foundation inspection is:
• Status: [Scheduled / Passed]

Once approved, we move to framing.

Best,
[Company Name]`,
  },
  {
    id: "addition-11-framing",
    type: "addition",
    step: 11,
    name: "Framing Phase",
    subject: "Framing in Progress",
    body: `Hi [Client Name],

Your addition is now taking shape.

Current phase:
• Structural framing (walls, roof structure)

Next:
• Rough inspections (electrical, plumbing, HVAC)

Best,
[Company Name]`,
  },
  {
    id: "addition-12-rough-mep",
    type: "addition",
    step: 12,
    name: "Rough MEP (Electrical, Plumbing, HVAC)",
    subject: "Systems Installation in Progress",
    body: `Hi [Client Name],

We are installing the internal systems:
• Electrical wiring
• Plumbing lines
• HVAC components

Next:
• Rough inspections by the city

Best,
[Company Name]`,
  },
  {
    id: "addition-13-rough-inspection",
    type: "addition",
    step: 13,
    name: "Rough Inspection",
    subject: "Inspection Update – Rough Stage",
    body: `Hi [Client Name],

Your project has reached the rough inspection phase.

Status: [Scheduled / Passed]

Once approved:
• Insulation and drywall will begin

Best,
[Company Name]`,
  },
  {
    id: "addition-14-insulation-drywall",
    type: "addition",
    step: 14,
    name: "Insulation + Drywall",
    subject: "Interior Progress Update",
    body: `Hi [Client Name],

We are progressing into interior work.

Current phase:
• Insulation
• Drywall installation

Your space is starting to feel like a finished room.

Next:
• Interior finishes

Best,
[Company Name]`,
  },
  {
    id: "addition-15-interior-finishes",
    type: "addition",
    step: 15,
    name: "Interior Finishes",
    subject: "Finishing Stage in Progress",
    body: `Hi [Client Name],

We are now completing interior finishes:
• Flooring
• Painting
• Cabinets / fixtures

We are nearing completion.

Best,
[Company Name]`,
  },
  {
    id: "addition-16-final-inspection",
    type: "addition",
    step: 16,
    name: "Final Inspection",
    subject: "Final Inspection Scheduled",
    body: `Hi [Client Name],

Your final inspection is:
• Status: [Scheduled / Passed]

This is the last step before project completion.

Best,
[Company Name]`,
  },
  {
    id: "addition-17-completion-walkthrough",
    type: "addition",
    step: 17,
    name: "Project Completion + Walkthrough",
    subject: "Project Completion & Walkthrough",
    body: `Hi [Client Name],

Your addition is now complete.

Next:
• Final walkthrough with you
• Punch list (if needed)

We want everything perfect before closing the project.

Best,
[Company Name]`,
  },
  {
    id: "addition-18-permit-closed",
    type: "addition",
    step: 18,
    name: "Permit Closed",
    subject: "Project Complete – Permit Closed",
    body: `Hi [Client Name],

Your project has officially passed final inspection and the permit is closed.

Documents provided:
• Final approvals
• Warranty information

Thank you for trusting us.

Best,
[Company Name]`,
  },
  {
    id: "addition-19-review-request",
    type: "addition",
    step: 19,
    name: "Review Request",
    subject: "We'd Appreciate Your Feedback",
    body: `Hi [Client Name],

It was a pleasure working with you.

If you're happy with your new space, we'd greatly appreciate a review:
[Review Link]

Thank you again,
[Company Name]`,
  },
  {
    id: "addition-20-post-project-followup",
    type: "addition",
    step: 20,
    name: "Post-Project Follow-Up (30–60 Days)",
    subject: "Checking In – Your New Space",
    body: `Hi [Client Name],

We hope you're enjoying your new addition.

If you notice anything or need adjustments, we're here to help.
Your project is backed by our warranty.

Best,
[Company Name]`,
  },
];

export const NURTURING_TEMPLATES: NurturingTemplate[] = [...ROOF, ...ADDITION];

export function fillTemplate(template: NurturingTemplate, clientName: string, companyName = "MIBH Construction"): { subject: string; body: string } {
  const replace = (s: string) => s.replace(/\[Client Name\]/g, clientName).replace(/\[Company Name\]/g, companyName);
  return { subject: replace(template.subject), body: replace(template.body) };
}
