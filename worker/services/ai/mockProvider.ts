import type {
  AiExpandResult,
  AiImproveSuggestions,
  AiNextActions,
  AiProjectPlan,
  AiReview,
} from "@shared/ai-schema";
import type {
  AIProvider,
  AiResult,
  ExpandTaskInput,
  GenerateProjectInput,
  ImproveProjectInput,
  ReviewProjectInput,
  SuggestNextActionsInput,
} from "./provider";
import type { AiTaskNode } from "@shared/ai-schema";
import { computeBackwardDate, daysBetween } from "../tasks/deadlines";

/**
 * Deterministic, offline AI provider. Every automated test (unit,
 * integration, E2E) runs against this provider so the suite never depends on
 * a paid API call. It uses keyword heuristics rather than an LLM, but the
 * shape and quality of its output mirrors what a real provider should
 * return, so it exercises every downstream code path realistically.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateProject(
    input: GenerateProjectInput,
  ): Promise<AiResult<AiProjectPlan>> {
    const start = Date.now();
    const domain = detectDomain(`${input.title} ${input.description ?? ""}`);
    const plan = buildDomainPlan(domain, input);
    return {
      data: plan,
      meta: makeMeta(this.name, Date.now() - start),
    };
  }

  async expandTask(input: ExpandTaskInput): Promise<AiResult<AiExpandResult>> {
    const start = Date.now();
    const subtasks = buildExpansion(input.taskTitle, input.deeper);
    return {
      data: { subtasks },
      meta: makeMeta(this.name, Date.now() - start),
    };
  }

  async reviewProject(input: ReviewProjectInput): Promise<AiResult<AiReview>> {
    const start = Date.now();
    const data = buildReview(input);
    return { data, meta: makeMeta(this.name, Date.now() - start) };
  }

  async suggestNextActions(
    input: SuggestNextActionsInput,
  ): Promise<AiResult<AiNextActions>> {
    const start = Date.now();
    const data = buildNextActions(input);
    return { data, meta: makeMeta(this.name, Date.now() - start) };
  }

  async improveProject(
    input: ImproveProjectInput,
  ): Promise<AiResult<AiImproveSuggestions>> {
    const start = Date.now();
    const data = buildImproveSuggestions(input);
    return { data, meta: makeMeta(this.name, Date.now() - start) };
  }
}

function makeMeta(provider: string, durationMs: number) {
  return {
    provider,
    model: "mock-v1",
    promptTokens: null,
    completionTokens: null,
    durationMs,
  };
}

function task(
  title: string,
  overrides: Partial<AiTaskNode> = {},
): AiTaskNode {
  return {
    title,
    description: overrides.description ?? "",
    priority: overrides.priority ?? "medium",
    estimatedEffort: overrides.estimatedEffort ?? "1h",
    suggestedDueDate: overrides.suggestedDueDate ?? null,
    reason: overrides.reason ?? "",
    dependencies: overrides.dependencies ?? [],
    requiresResearch: overrides.requiresResearch ?? false,
    taskType: overrides.taskType ?? "task",
    subtasks: overrides.subtasks ?? [],
  };
}

type Domain =
  | "trade_show"
  | "travel"
  | "product_launch"
  | "home_project"
  | "meeting"
  | "hiring"
  | "celebration"
  | "fundraising"
  | "generic";

function detectDomain(text: string): Domain {
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => t.includes(w));

  if (has("eicma", "trade show", "exhibit", "expo", "booth", "ces "))
    return "trade_show";
  if (has("trip", "travel", "vacation", "holiday", "visa", "itinerary"))
    return "travel";
  if (has("launch", "website", "product launch", "app launch", "release"))
    return "product_launch";
  if (has("renovat", "kitchen", "remodel", "home project", "extension build"))
    return "home_project";
  if (has("investor", "board meeting", "pitch", "presentation", "meeting with"))
    return "meeting";
  if (has("hire", "hiring", "recruit", "candidate", "interview loop"))
    return "hiring";
  if (has("party", "wedding", "celebration", "christmas", "anniversary"))
    return "celebration";
  if (has("fundrais", "donation", "campaign", "charity"))
    return "fundraising";
  return "generic";
}

const backwardDate = computeBackwardDate;

function buildDomainPlan(domain: Domain, input: GenerateProjectInput): AiProjectPlan {
  const deadline = input.deadline;
  const contextNote =
    input.relevantContext.length > 0
      ? `Incorporated ${input.relevantContext.length} saved context item(s).`
      : "";
  const memoryNote =
    input.similarProjects.length > 0
      ? `Reviewed ${input.similarProjects.length} similar previous project(s) for commonly forgotten items.`
      : "";

  const builders: Record<Domain, () => AiProjectPlan> = {
    trade_show: () => tradeShowPlan(input),
    travel: () => travelPlan(input),
    product_launch: () => productLaunchPlan(input),
    home_project: () => homeProjectPlan(input),
    meeting: () => meetingPlan(input),
    hiring: () => hiringPlan(input),
    celebration: () => celebrationPlan(input),
    fundraising: () => fundraisingPlan(input),
    generic: () => genericPlan(input),
  };

  const plan = builders[domain]();
  plan.projectSummary = [plan.projectSummary, contextNote, memoryNote]
    .filter(Boolean)
    .join(" ");
  if (deadline) {
    plan.suggestedMilestones = plan.suggestedMilestones.map((m, i) => ({
      ...m,
      dueDate: m.dueDate ?? backwardDate(deadline, (plan.suggestedMilestones.length - i) * 3),
    }));
  }
  return plan;
}

function tradeShowPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan to prepare for and exhibit at ${input.title}, covering administration, logistics, the exhibit itself, marketing and travel.`,
    assumptions: [
      "Assumed the exhibit will use motorised transport for equipment/products unless noted otherwise.",
      "Assumed at least one prior similar event exists to model booth requirements on.",
    ],
    questions: [
      "How many people/products are being exhibited?",
      "What are the exact exhibitor deadlines for this event?",
      "How many team members are attending on-site?",
    ],
    risks: [
      "Exhibitor deadlines may be earlier than expected — confirm dates immediately.",
      "Shipping/transport delays could leave the stand incomplete on setup day.",
    ],
    missingInformation: [
      "Exact booth number and dimensions",
      "Number of exhibitor passes required",
    ],
    suggestedMilestones: [
      { title: "Booking & requirements confirmed", dueDate: backwardDate(d, 60), description: "" },
      { title: "Design locked", dueDate: backwardDate(d, 30), description: "" },
      { title: "Production & orders complete", dueDate: backwardDate(d, 14), description: "" },
      { title: "Transport & packing ready", dueDate: backwardDate(d, 3), description: "" },
      { title: "Departure", dueDate: backwardDate(d, 1), description: "" },
    ],
    workstreams: [
      {
        title: "Event administration",
        description: "Booth, exhibitor rules, and compliance.",
        tasks: [
          task("Confirm booth booking", { priority: "critical", requiresResearch: true }),
          task("Review exhibitor requirements", { requiresResearch: true }),
          task("Check exhibitor deadlines", { priority: "high", requiresResearch: true }),
          task("Organise exhibitor passes"),
          task("Arrange insurance", { priority: "high" }),
        ],
      },
      {
        title: "Transport & logistics",
        description: "Getting people and equipment to the venue and back.",
        tasks: [
          task("Organise van or freight", {
            subtasks: [
              task("Get van dimensions"),
              task("Confirm loading capacity"),
              task("Reserve van"),
              task("Confirm pickup"),
            ],
          }),
          task("Plan loading", {
            subtasks: [
              task("Create loading list"),
              task("Confirm straps"),
              task("Confirm ramps/dollies"),
            ],
          }),
          task("Plan route and parking/access"),
        ],
      },
      {
        title: "Stand",
        description: "Physical build of the exhibit space.",
        tasks: [
          task("Finalise stand layout"),
          task("Arrange furniture"),
          task("Arrange lighting"),
          task("Confirm power requirements"),
          task("Arrange displays/screens"),
          task("Arrange internet access"),
          task("Order signage"),
          task("Plan installation", { priority: "high" }),
          task("Plan dismantling"),
        ],
      },
      {
        title: "Marketing",
        description: "Materials and content to bring visitors to the stand.",
        tasks: [
          task("Design banners"),
          task("Print banners", { dependencies: ["Design banners"], taskType: "item" }),
          task("Design stickers"),
          task("Produce stickers", { dependencies: ["Design stickers"], taskType: "item" }),
          task("Prepare brochures", { taskType: "item" }),
          task("Prepare QR codes / lead capture"),
          task("Prepare social media content"),
        ],
      },
      {
        title: "Merchandise",
        description: "Giveaway and sale items for the stand.",
        tasks: [
          task("Decide merchandise"),
          task("Design merchandise", { dependencies: ["Decide merchandise"] }),
          task("Order merchandise", {
            dependencies: ["Design merchandise"],
            taskType: "item",
          }),
          task("Check delivery"),
          task("Pack merchandise", { taskType: "item" }),
        ],
      },
      {
        title: "Travel",
        description: "Getting the team to the event.",
        tasks: [
          task("Book hotel"),
          task("Book transport"),
          task("Confirm staff schedule"),
          task("Check travel documents", { requiresResearch: true }),
        ],
      },
      {
        title: "Packing",
        description: "Final checklist of everything that needs to travel.",
        tasks: [
          task("Chargers and cables", { taskType: "item" }),
          task("Tools and spare parts", { taskType: "item" }),
          task("Banners and stickers", { taskType: "item" }),
          task("Screens and adapters", { taskType: "item" }),
          task("Printed materials", { taskType: "item" }),
          task("Cleaning equipment", { taskType: "item" }),
          task("Personal items", { taskType: "item" }),
        ],
      },
    ],
  };
}

function travelPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan for ${input.title}, covering entry requirements, bookings, itinerary and packing.`,
    assumptions: ["Assumed international travel requiring passport validity checks."],
    questions: [
      "How many travellers, and do all need visas?",
      "What is the budget range for flights and accommodation?",
      "Are there must-see destinations or fixed commitments during the trip?",
    ],
    risks: [
      "Entry requirements can change close to departure — reverify before travel.",
      "Peak-season accommodation may sell out if booked late.",
    ],
    missingInformation: ["Exact travel dates", "Number of travellers"],
    suggestedMilestones: [
      { title: "Entry requirements confirmed", dueDate: backwardDate(d, 45), description: "" },
      { title: "Flights & accommodation booked", dueDate: backwardDate(d, 30), description: "" },
      { title: "Itinerary finalised", dueDate: backwardDate(d, 7), description: "" },
      { title: "Packed & ready", dueDate: backwardDate(d, 1), description: "" },
    ],
    workstreams: [
      {
        title: "Entry & documentation",
        description: "Legal requirements to enter and travel.",
        tasks: [
          task("Check passport validity", { priority: "critical" }),
          task("Research visa/entry requirements", { requiresResearch: true, priority: "high" }),
          task("Arrange travel insurance"),
          task("Check vaccination/health requirements", { requiresResearch: true }),
        ],
      },
      {
        title: "Bookings",
        description: "Flights, accommodation and transport.",
        tasks: [
          task("Book flights", { priority: "high" }),
          task("Book accommodation"),
          task("Arrange local transport / rail passes"),
        ],
      },
      {
        title: "Itinerary",
        description: "Plan for each day of the trip.",
        tasks: [
          task("Draft day-by-day itinerary"),
          task("Book key activities/reservations in advance"),
          task("Identify backup plans for weather-dependent days"),
        ],
      },
      {
        title: "Money & connectivity",
        description: "Practical logistics while travelling.",
        tasks: [
          task("Arrange local currency / travel card"),
          task("Arrange mobile data / eSIM"),
        ],
      },
      {
        title: "Packing",
        description: "What to bring.",
        tasks: [
          task("Weather-appropriate clothing", { taskType: "item" }),
          task("Chargers and adapters", { taskType: "item" }),
          task("Travel documents copy (physical + digital)", { taskType: "item" }),
          task("Medications", { taskType: "item" }),
        ],
      },
    ],
  };
}

function productLaunchPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan to ${input.title.toLowerCase()}, covering build, content, QA, and go-live.`,
    assumptions: ["Assumed a single primary launch date rather than a phased rollout."],
    questions: [
      "Who is the target audience and what's the primary call to action?",
      "Is there an existing brand/design system to follow?",
      "What analytics or success metrics matter most?",
    ],
    risks: [
      "Content readiness often lags behind engineering — track it as its own workstream.",
      "DNS/SSL cutover can cause downtime if not scheduled carefully.",
    ],
    missingInformation: ["Target launch date", "Hosting/infrastructure decision"],
    suggestedMilestones: [
      { title: "Scope & design locked", dueDate: backwardDate(d, 30), description: "" },
      { title: "Build feature-complete", dueDate: backwardDate(d, 14), description: "" },
      { title: "QA sign-off", dueDate: backwardDate(d, 5), description: "" },
      { title: "Go live", dueDate: d, description: "" },
    ],
    workstreams: [
      {
        title: "Planning & design",
        description: "Define scope and look and feel.",
        tasks: [
          task("Define goals and success metrics"),
          task("Create sitemap / information architecture"),
          task("Design key pages", { priority: "high" }),
          task("Review and approve designs", { dependencies: ["Design key pages"] }),
        ],
      },
      {
        title: "Build",
        description: "Engineering work.",
        tasks: [
          task("Set up hosting and domain", { requiresResearch: true }),
          task("Implement core pages"),
          task("Implement forms/integrations"),
          task("Cross-browser and mobile testing"),
        ],
      },
      {
        title: "Content",
        description: "Copy and media.",
        tasks: [
          task("Write page copy"),
          task("Source/produce images and video"),
          task("SEO metadata and sitemap"),
        ],
      },
      {
        title: "Marketing & launch comms",
        description: "Telling people it exists.",
        tasks: [
          task("Prepare launch announcement"),
          task("Prepare social media content"),
          task("Notify existing customers/subscribers"),
        ],
      },
      {
        title: "Go-live",
        description: "Cutover and post-launch checks.",
        tasks: [
          task("Final QA pass", { priority: "critical" }),
          task("DNS/SSL cutover", { priority: "critical" }),
          task("Monitor analytics and error logs post-launch"),
        ],
      },
    ],
  };
}

function homeProjectPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan for ${input.title}, covering design, budgeting, contractors, and execution.`,
    assumptions: ["Assumed professional contractors will be used for structural/electrical/plumbing work."],
    questions: [
      "What is the total budget?",
      "Is planning permission or building control approval required?",
      "Will you need to live around the works, or is alternative accommodation needed?",
    ],
    risks: [
      "Contractor availability can push timelines significantly — book early.",
      "Unexpected structural issues are common once work starts.",
    ],
    missingInformation: ["Budget ceiling", "Target start date"],
    suggestedMilestones: [
      { title: "Design & budget agreed", dueDate: backwardDate(d, 45), description: "" },
      { title: "Contractors booked", dueDate: backwardDate(d, 30), description: "" },
      { title: "Materials ordered", dueDate: backwardDate(d, 21), description: "" },
      { title: "Work complete", dueDate: d, description: "" },
    ],
    workstreams: [
      {
        title: "Planning & design",
        description: "Decide what you're building.",
        tasks: [
          task("Set budget"),
          task("Create design / layout"),
          task("Check planning permission requirements", { requiresResearch: true }),
        ],
      },
      {
        title: "Contractors & suppliers",
        description: "Who will do the work.",
        tasks: [
          task("Get quotes from contractors", { priority: "high" }),
          task("Book contractor", { dependencies: ["Get quotes from contractors"] }),
          task("Order materials", { taskType: "item" }),
        ],
      },
      {
        title: "Execution",
        description: "The work itself.",
        tasks: [
          task("Demolition/strip-out"),
          task("First fix (electrics/plumbing)"),
          task("Installation"),
          task("Second fix and finishing"),
        ],
      },
      {
        title: "Wrap-up",
        description: "Final checks.",
        tasks: [
          task("Snagging walkthrough"),
          task("Final clean"),
          task("Final payment and sign-off"),
        ],
      },
    ],
  };
}

function meetingPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Preparation plan for ${input.title}, covering materials, logistics, and follow-up.`,
    assumptions: ["Assumed the meeting has a fixed date and known attendee list."],
    questions: [
      "Who are the attendees and what do they most care about?",
      "What decision or outcome are you seeking from this meeting?",
      "Is this in-person, hybrid, or fully remote?",
    ],
    risks: ["Materials finished at the last minute leave no time for rehearsal."],
    missingInformation: ["Attendee list", "Meeting format (in-person/remote)"],
    suggestedMilestones: [
      { title: "Narrative & content locked", dueDate: backwardDate(d, 10), description: "" },
      { title: "Materials finalised", dueDate: backwardDate(d, 3), description: "" },
      { title: "Rehearsal complete", dueDate: backwardDate(d, 1), description: "" },
    ],
    workstreams: [
      {
        title: "Content",
        description: "What you'll say and show.",
        tasks: [
          task("Define key messages and desired outcome", { priority: "critical" }),
          task("Build presentation deck"),
          task("Gather supporting data/metrics", { requiresResearch: true }),
          task("Prepare Q&A / objection responses"),
        ],
      },
      {
        title: "Logistics",
        description: "Practical arrangements.",
        tasks: [
          task("Confirm attendees and time"),
          task("Book room / send video link"),
          task("Arrange refreshments if in-person"),
        ],
      },
      {
        title: "Rehearsal & review",
        description: "Getting ready to present.",
        tasks: [
          task("Internal review of materials"),
          task("Run through / rehearsal", { dependencies: ["Build presentation deck"] }),
        ],
      },
      {
        title: "Follow-up",
        description: "After the meeting.",
        tasks: [
          task("Send follow-up notes/actions"),
          task("Track agreed next steps"),
        ],
      },
    ],
  };
}

function hiringPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Hiring plan for ${input.title}, from role definition through offer.`,
    assumptions: ["Assumed a single open headcount rather than a multi-role hiring round."],
    questions: [
      "What level and budget range is approved for this role?",
      "Who is on the interview panel?",
      "What is the target start date?",
    ],
    risks: ["Slow interview scheduling is the most common cause of losing strong candidates."],
    missingInformation: ["Approved salary band", "Target start date"],
    suggestedMilestones: [
      { title: "Job description approved", dueDate: backwardDate(d, 60), description: "" },
      { title: "Shortlist complete", dueDate: backwardDate(d, 30), description: "" },
      { title: "Offer accepted", dueDate: backwardDate(d, 7), description: "" },
    ],
    workstreams: [
      {
        title: "Role definition",
        description: "What you're hiring for.",
        tasks: [
          task("Write job description", { priority: "high" }),
          task("Define interview scorecard/criteria"),
          task("Get budget/headcount approval"),
        ],
      },
      {
        title: "Sourcing",
        description: "Finding candidates.",
        tasks: [
          task("Post job listing"),
          task("Brief recruiters/agencies"),
          task("Source candidates directly"),
        ],
      },
      {
        title: "Interviewing",
        description: "Assessing candidates.",
        tasks: [
          task("Screen applications"),
          task("Schedule interview loop"),
          task("Collect panel feedback"),
        ],
      },
      {
        title: "Offer & onboarding",
        description: "Closing and starting.",
        tasks: [
          task("Extend offer", { priority: "critical" }),
          task("Prepare onboarding plan"),
          task("Arrange equipment and access", { taskType: "item" }),
        ],
      },
    ],
  };
}

function celebrationPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan for ${input.title}, covering venue, guests, catering and entertainment.`,
    assumptions: ["Assumed an in-person event with a guest list to manage."],
    questions: [
      "How many guests, and what's the budget?",
      "Is there a theme or dress code?",
      "Any dietary requirements to plan catering around?",
    ],
    risks: ["Popular venues and caterers book out early — confirm both as soon as possible."],
    missingInformation: ["Guest count", "Budget"],
    suggestedMilestones: [
      { title: "Venue & date confirmed", dueDate: backwardDate(d, 60), description: "" },
      { title: "Guest list & invites sent", dueDate: backwardDate(d, 30), description: "" },
      { title: "Final headcount to caterer", dueDate: backwardDate(d, 7), description: "" },
    ],
    workstreams: [
      {
        title: "Venue & date",
        description: "Where and when.",
        tasks: [
          task("Choose and book venue", { priority: "critical" }),
          task("Confirm capacity and access"),
        ],
      },
      {
        title: "Guests",
        description: "Who's coming.",
        tasks: [
          task("Build guest list"),
          task("Send invitations"),
          task("Track RSVPs"),
        ],
      },
      {
        title: "Catering & drinks",
        description: "Food and drink.",
        tasks: [
          task("Book caterer"),
          task("Confirm dietary requirements"),
          task("Arrange drinks/bar"),
        ],
      },
      {
        title: "Entertainment & decor",
        description: "Atmosphere.",
        tasks: [
          task("Book music/entertainment"),
          task("Plan decorations", { taskType: "item" }),
        ],
      },
    ],
  };
}

function fundraisingPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Fundraising plan for ${input.title}, covering strategy, outreach, and reporting.`,
    assumptions: ["Assumed a defined fundraising target amount will be set early."],
    questions: [
      "What is the fundraising target and deadline?",
      "Who is the primary donor audience?",
      "What reporting/compliance is required for donors?",
    ],
    risks: ["Underestimating outreach lead time is the most common cause of missed targets."],
    missingInformation: ["Fundraising target amount", "Primary donor audience"],
    suggestedMilestones: [
      { title: "Strategy & target agreed", dueDate: backwardDate(d, 45), description: "" },
      { title: "Outreach launched", dueDate: backwardDate(d, 30), description: "" },
      { title: "Campaign closes", dueDate: d, description: "" },
    ],
    workstreams: [
      {
        title: "Strategy",
        description: "Plan before you ask.",
        tasks: [
          task("Set fundraising target"),
          task("Identify donor segments"),
          task("Choose fundraising channels"),
        ],
      },
      {
        title: "Outreach",
        description: "Asking.",
        tasks: [
          task("Prepare donor communications"),
          task("Launch campaign page"),
          task("Follow up with prospective donors"),
        ],
      },
      {
        title: "Operations",
        description: "Keeping track.",
        tasks: [
          task("Set up donation processing"),
          task("Track donations and send receipts"),
        ],
      },
      {
        title: "Reporting",
        description: "Closing the loop.",
        tasks: [
          task("Thank donors"),
          task("Report results internally"),
        ],
      },
    ],
  };
}

function genericPlan(input: GenerateProjectInput): AiProjectPlan {
  const d = input.deadline;
  return {
    projectSummary: `Plan to achieve: ${input.title}.`,
    assumptions: ["Assumed this outcome can be delivered by one person with occasional help."],
    questions: [
      "Is there a hard deadline, and what happens if it slips?",
      "What resources (budget, people, tools) are already available?",
      "What does 'done' look like exactly?",
    ],
    risks: ["Scope may grow once work starts — revisit this plan after the first review."],
    missingInformation: ["Success criteria", "Available budget/resources"],
    suggestedMilestones: [
      { title: "Plan agreed", dueDate: backwardDate(d, 21), description: "" },
      { title: "Core work complete", dueDate: backwardDate(d, 7), description: "" },
      { title: "Ready", dueDate: d, description: "" },
    ],
    workstreams: [
      {
        title: "Planning & research",
        description: "Understand what's required before committing resources.",
        tasks: [
          task("Clarify scope and success criteria", { priority: "high" }),
          task("Identify who needs to be involved"),
          task("Research anything unknown or unfamiliar", { requiresResearch: true }),
        ],
      },
      {
        title: "Preparation",
        description: "Get everything ready to execute.",
        tasks: [
          task("Gather required resources/materials", { taskType: "item" }),
          task("Make necessary bookings or purchases"),
          task("Confirm dependencies with any third parties"),
        ],
      },
      {
        title: "Execution",
        description: "Do the work.",
        tasks: [task("Complete the core work", { priority: "high" })],
      },
      {
        title: "Review & wrap-up",
        description: "Confirm it's actually done.",
        tasks: [
          task("Review against success criteria"),
          task("Close out loose ends and notify stakeholders"),
        ],
      },
    ],
  };
}

function buildExpansion(taskTitle: string, deeper: boolean): AiTaskNode[] {
  const t = taskTitle.toLowerCase();
  const suffix = deeper ? " (detail)" : "";

  if (t.includes("merch")) {
    return [
      task("Decide merchandise types" + suffix),
      task("Determine quantities" + suffix),
      task("Collect sizes" + suffix),
      task("Confirm branding" + suffix),
      task("Create designs" + suffix),
      task("Review designs" + suffix, { dependencies: ["Create designs" + suffix] }),
      task("Export print-ready artwork" + suffix),
      task("Request supplier quote" + suffix),
      task("Approve samples" + suffix),
      task("Order production" + suffix, { taskType: "item" }),
      task("Confirm delivery date" + suffix),
    ];
  }
  if (t.includes("bike") || t.includes("motorcycle") || t.includes("vehicle")) {
    return [
      task("Confirm which units will attend" + suffix),
      task("Mechanical inspection" + suffix, { priority: "high" }),
      task("Cosmetic/detailing pass" + suffix),
      task("Electronics/software check" + suffix, { requiresResearch: true }),
      task("Charge batteries" + suffix, { taskType: "item" }),
      task("Check tyre pressure" + suffix),
      task("Prepare keys and chargers" + suffix, { taskType: "item" }),
      task("Prepare spare parts" + suffix, { taskType: "item" }),
      task("Prepare tools" + suffix, { taskType: "item" }),
      task("Damage inspection and documentation" + suffix),
      task("Transport protection / covers" + suffix, { taskType: "item" }),
      task("Final acceptance check" + suffix, { priority: "high" }),
    ];
  }
  if (t.includes("pack")) {
    return [
      task("List everything that needs to travel" + suffix),
      task("Group items by category" + suffix),
      task("Assign packing owner per category" + suffix),
      task("Pack and label" + suffix, { taskType: "item" }),
      task("Verify against checklist before departure" + suffix),
    ];
  }

  // Generic fallback expansion: works for any task title.
  return [
    task(`Clarify exact requirements for ${taskTitle}` + suffix),
    task(`Identify who or what is needed for ${taskTitle}` + suffix),
    task(`Complete ${taskTitle}` + suffix, { priority: "high" }),
    task(`Review and confirm ${taskTitle} is done` + suffix),
  ];
}

function buildReview(input: ReviewProjectInput): AiReview {
  const allTitles = new Set(
    [...input.completedTaskTitles, ...input.incompleteTaskTitles].map((t) =>
      t.toLowerCase(),
    ),
  );
  const missingTasks: AiReview["missingTasks"] = [];
  if (![...allTitles].some((t) => t.includes("pack")))
    missingTasks.push({
      title: "Create a final packing/checklist review",
      reason: "No packing or final-checklist task was found — easy to forget last-minute items.",
      suggestedWorkstream: null,
      priority: "medium",
    });
  if (![...allTitles].some((t) => t.includes("budget") || t.includes("cost")))
    missingTasks.push({
      title: "Confirm budget is on track",
      reason: "No budget-tracking task found.",
      suggestedWorkstream: null,
      priority: "low",
    });

  const risks: string[] = [];
  if (input.deadline) {
    const daysLeft = daysBetween(input.currentDate, input.deadline);
    if (daysLeft <= 14 && daysLeft >= 0) {
      risks.push(
        `Deadline is only ${daysLeft} day(s) away — limited buffer if anything slips.`,
      );
    } else if (daysLeft < 0) {
      risks.push("The deadline has already passed.");
    }
  }
  if (input.incompleteTaskTitles.length > 0 && input.completedTaskTitles.length === 0) {
    risks.push("No tasks have been completed yet — confirm the project has actually started.");
  }

  const blockers = input.blockedTaskTitles.map((title) => ({
    taskTitle: title,
    reason: "Marked blocked/waiting — needs follow-up to unblock.",
  }));

  const upcomingDeadlines = input.deadline
    ? [{ taskTitle: "Project deadline", dueDate: input.deadline, note: "Final deadline for the project." }]
    : [];

  const suggestedNextActions = input.incompleteTaskTitles.slice(0, 3).map((t) => `Continue: ${t}`);

  return { missingTasks, risks, upcomingDeadlines, blockers, suggestedNextActions };
}

function buildNextActions(input: SuggestNextActionsInput): AiNextActions {
  const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const candidates = input.candidateTasks
    .filter((t) => !input.blockedTaskIds.has(t.id) && t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const pr = priorityRank[a.priority] - priorityRank[b.priority];
      if (pr !== 0) return pr;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    })
    .slice(0, 5);

  const actions = candidates.map((t) => ({
    taskId: t.id,
    taskTitle: t.title,
    explanation: t.dueDate
      ? `${t.priority} priority, due ${t.dueDate}.`
      : `${t.priority} priority with no due date set — worth scheduling.`,
  }));

  return { actions };
}

function buildImproveSuggestions(input: ImproveProjectInput): AiImproveSuggestions {
  const suggestions: AiImproveSuggestions["suggestions"] = [];
  let counter = 1;

  for (const ws of input.workstreamSummaries) {
    if (ws.taskTitles.length === 0) {
      suggestions.push({
        id: `sugg-${counter++}`,
        type: "missing_task",
        title: `Add tasks to "${ws.title}"`,
        description: `The "${ws.title}" workstream has no tasks yet.`,
        targetTaskTitle: null,
      });
    }
    const seen = new Map<string, string>();
    for (const title of ws.taskTitles) {
      const key = title.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(key)) {
        suggestions.push({
          id: `sugg-${counter++}`,
          type: "redundant_task",
          title: `Possible duplicate: "${title}"`,
          description: `"${title}" looks similar to "${seen.get(key)}" — consider merging.`,
          targetTaskTitle: title,
        });
      } else {
        seen.set(key, title);
      }
    }
  }

  if (input.workstreamSummaries.length > 0 && suggestions.length === 0) {
    suggestions.push({
      id: `sugg-${counter++}`,
      type: "missing_workstream",
      title: "Consider a final review/wrap-up workstream",
      description:
        "No workstream appears dedicated to final review or close-out — worth adding one close to the deadline.",
      targetTaskTitle: null,
    });
  }

  return { suggestions };
}
