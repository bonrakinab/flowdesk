import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, addHours, setHours, setMinutes } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  await prisma.pomodoroSession.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.ticketTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.note.deleteMany();
  await prisma.noteFolder.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.household.deleteMany();

  const household = await prisma.household.create({
    data: {
      name: "Demo Family",
      inviteCode: "FAMILY",
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const you = await prisma.user.create({
    data: {
      name: "Alex",
      email: "alex@flowdesk.local",
      passwordHash,
      color: "#0d9488",
      householdId: household.id,
    },
  });

  const partner = await prisma.user.create({
    data: {
      name: "Sam",
      email: "sam@flowdesk.local",
      passwordHash,
      color: "#d97706",
      householdId: household.id,
    },
  });

  const [work, home, family] = await Promise.all([
    prisma.project.create({
      data: { name: "Work", color: "#0284c7", householdId: household.id },
    }),
    prisma.project.create({
      data: { name: "Home", color: "#d97706", householdId: household.id },
    }),
    prisma.project.create({
      data: { name: "Family", color: "#e11d48", householdId: household.id },
    }),
  ]);

  await prisma.noteFolder.createMany({
    data: [
      { name: "Personal", householdId: household.id },
      { name: "Family", householdId: household.id },
      { name: "Ideas", householdId: household.id },
      { name: "Meeting notes", householdId: household.id },
    ],
  });

  const folders = await prisma.noteFolder.findMany({
    where: { householdId: household.id },
  });

  const jordan = await prisma.contact.create({
    data: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      company: "Northwind",
      notes: "Waiting on contract feedback",
      householdId: household.id,
    },
  });

  const now = new Date();
  const todayEvening = setMinutes(setHours(now, 18), 0);

  const tickets = await Promise.all([
    prisma.ticket.create({
      data: {
        title: "Prepare Q3 client update",
        description: "Slides + talking points for Friday call",
        type: "task",
        status: "Doing",
        priority: "P1",
        energy: "high",
        estimateMin: 45,
        dueAt: todayEvening,
        isFocus: true,
        projectId: work.id,
        assigneeId: you.id,
        createdById: you.id,
        householdId: household.id,
        activities: {
          create: { message: "created ticket", userId: you.id },
        },
        checklist: {
          create: [
            { title: "Draft outline", done: true, sortOrder: 0 },
            { title: "Add metrics", done: false, sortOrder: 1 },
          ],
        },
      },
    }),
    prisma.ticket.create({
      data: {
        title: "Follow up with Jordan on contract",
        type: "follow_up",
        status: "Waiting",
        priority: "P1",
        waitingOn: "Jordan — contract markup",
        dueAt: addDays(now, 1),
        contactId: jordan.id,
        projectId: work.id,
        assigneeId: you.id,
        createdById: you.id,
        householdId: household.id,
        activities: {
          create: { message: "created ticket", userId: you.id },
        },
        reminders: {
          create: {
            title: "Ping Jordan if no reply",
            remindAt: addHours(now, 2),
          },
        },
      },
    }),
    prisma.ticket.create({
      data: {
        title: "Book dentist for kids",
        type: "task",
        status: "Ready",
        priority: "P2",
        energy: "low",
        estimateMin: 10,
        dueAt: addDays(now, 2),
        projectId: family.id,
        assigneeId: partner.id,
        createdById: partner.id,
        householdId: household.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: "Fix leaking faucet",
        type: "issue",
        status: "Backlog",
        priority: "P3",
        estimateMin: 30,
        projectId: home.id,
        assigneeId: you.id,
        createdById: you.id,
        householdId: household.id,
      },
    }),
    prisma.ticket.create({
      data: {
        title: "Idea: weekend hiking spot",
        type: "idea",
        status: "Backlog",
        priority: "P3",
        isInbox: true,
        assigneeId: you.id,
        createdById: you.id,
        householdId: household.id,
      },
    }),
  ]);

  await prisma.calendarEvent.createMany({
    data: [
      {
        title: "Family dinner",
        type: "family",
        startAt: todayEvening,
        endAt: addHours(todayEvening, 2),
        householdId: household.id,
        assigneeId: you.id,
        color: "#e11d48",
      },
      {
        title: "Team standup",
        type: "meeting",
        startAt: addDays(setMinutes(setHours(now, 9), 30), 1),
        endAt: addDays(setMinutes(setHours(now, 10), 0), 1),
        householdId: household.id,
        assigneeId: you.id,
      },
      {
        title: "School pickup",
        type: "reminder",
        startAt: addDays(setMinutes(setHours(now, 15), 15), 0),
        endAt: addDays(setMinutes(setHours(now, 15), 45), 0),
        householdId: household.id,
        assigneeId: partner.id,
        color: "#d97706",
      },
    ],
  });

  await prisma.note.create({
    data: {
      title: "Welcome to Flowdesk",
      content: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This is your household notepad. Capture meeting notes, ideas, and family plans.",
              },
            ],
          },
        ],
      }),
      mood: "#ccfbf1",
      pinned: true,
      folderId: folders.find((f) => f.name === "Family")?.id,
      householdId: household.id,
      lastEditedById: you.id,
    },
  });

  console.log("Seeded demo household");
  console.log("Login: alex@flowdesk.local / password123");
  console.log("Partner: sam@flowdesk.local / password123");
  console.log("Invite code:", household.inviteCode);
  console.log("Sample tickets:", tickets.length);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
