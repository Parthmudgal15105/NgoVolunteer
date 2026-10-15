import "dotenv/config";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { connectDB } from "./config/db.js";
import {
  User,
  VolunteerProfile,
  Event,
  EventRegistration,
  Attendance,
  Certificate,
  Notification,
  Announcement,
} from "./models/index.js";
import { issueCertificates } from "./utils/certificates.js";
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });
export async function seed() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is disabled in production.");
  if (await User.exists({ email: "admin@kindred.org" })) {
    console.log("Demo data already exists; nothing changed.");
    return;
  }
  const password = await bcrypt.hash("Volunteer@123", 12);
  const admin = await User.create({
    name: "Aarav Sharma",
    email: "admin@kindred.org",
    password,
    role: "admin",
  });
  const volunteers = await User.insertMany(
    [
      "Maya Patel",
      "Rohan Verma",
      "Ananya Singh",
      "Kabir Mehta",
      "Isha Rao",
    ].map((name, i) => ({
      name,
      email:
        i === 0
          ? "maya@example.com"
          : `${name.split(" ")[0].toLowerCase()}@example.com`,
      password,
    })),
  );
  await VolunteerProfile.insertMany(
    volunteers.map((v, i) => ({
      user: v._id,
      bio: "Excited to give back to my local community.",
      skills: [
        [
          "Teaching",
          "Photography",
          "First aid",
          "Event planning",
          "Communication",
        ][i],
      ],
      interests: [["Environment", "Education", "Health"][i % 3]],
      availability: "Weekends, 9 am – 2 pm",
    })),
  );
  const titles = [
    "Tree Plantation Drive",
    "Food Distribution Campaign",
    "Blood Donation Camp",
    "Community Cleanup",
    "Education Support Program",
    "Coastal Conservation Day",
    "Community Kitchen",
    "Digital Literacy Workshop",
  ];
  const cats = [
    "Environment",
    "Food security",
    "Health",
    "Community",
    "Education",
    "Environment",
    "Food security",
    "Education",
  ];
  const descriptions = [
    "Help us turn an urban space into a greener tomorrow. Plant saplings and learn how to care for our local environment.",
    "Prepare and distribute nutritious meals to families in need. A few hours of your time can brighten someone’s day.",
    "Support our medical partners with registration, donor care, and community outreach at our donation camp.",
    "Join neighbours to clean shared spaces and build a healthier, happier community.",
    "Make learning a little brighter. Help children with reading, maths, and creative activities.",
    "Protect our coastline with a morning of cleanup, conservation, and collective action.",
    "Cook, connect, and serve warm meals alongside our community kitchen team.",
    "Help community members build confidence using computers and everyday digital tools.",
  ];
  const events = await Event.insertMany(
    titles.map((title, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (i < 3 ? -25 + i * 7 : 3 + (i - 3) * 5));
      d.setHours(9, 0, 0, 0);
      return {
        title,
        description: descriptions[i],
        category: cats[i],
        location: [
          "Sanjay Gandhi National Park, Mumbai",
          "Andheri Community Centre, Mumbai",
          "City Health Centre, Mumbai",
          "Juhu Beach, Mumbai",
          "Pragati Learning Centre, Mumbai",
          "Versova Beach, Mumbai",
          "Seva Kitchen, Mumbai",
          "Community Library, Mumbai",
        ][i],
        date: d,
        hours: [4, 3, 5, 3, 2, 4, 3, 2][i],
        capacity: 20 + i * 5,
        status: i < 3 ? "completed" : "upcoming",
        createdBy: admin._id,
      };
    }),
  );
  for (let i = 0; i < volunteers.length; i++) {
    for (let j = 0; j < 3; j++) {
      await EventRegistration.create({
        event: events[j]._id,
        volunteer: volunteers[i]._id,
        status: "approved",
      });
      await Attendance.create({
        event: events[j]._id,
        volunteer: volunteers[i]._id,
        status: i === 4 && j === 2 ? "absent" : "present",
        hours: i === 4 && j === 2 ? 0 : events[j].hours,
        markedBy: admin._id,
      });
    }
    await EventRegistration.create({
      event: events[3 + (i % 3)]._id,
      volunteer: volunteers[i]._id,
      status: i % 2 === 0 ? "approved" : "pending",
    });
    await Notification.create({
      user: volunteers[i]._id,
      message:
        "Welcome to Kindred! Complete your profile and discover your next opportunity to make a difference.",
    });
  }
  for (const event of events.slice(0, 3)) await issueCertificates(event._id);
  await Announcement.insertMany([
    {
      title: "A greener tomorrow starts with us",
      message:
        "Bring a reusable water bottle and comfortable shoes to our next outdoor drive. We’ll take care of the rest.",
      createdBy: admin._id,
    },
    {
      title: "Thank you for showing up",
      message:
        "Our recent community campaigns were powered by your time, care, and kindness. Your certificates are now available in your workspace.",
      createdBy: admin._id,
    },
  ]);
  console.log(
    "Demo data created. admin@kindred.org / maya@example.com — Volunteer@123",
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await connectDB();
    await seed();
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
