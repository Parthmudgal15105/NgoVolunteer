import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin, HandHeart } from "lucide-react";
import { State, Empty, date } from "./Common";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../services/useData";
export default function VolunteerOverview({ dashboard }) {
  const { user } = useAuth();
  const { data: profile, error: profileError } = useData("/profile");
  const { data: events, error: eventsError } = useData("/events");
  const drives = events
    ?.filter((e) => e.status === "upcoming" && new Date(e.date) >= new Date())
    .slice(0, 3);
  return (
    <div className="volunteer-overview">
      <div className="volunteer-welcome">
        <h1>
          Welcome, {user.name}! <HandHeart size={27} aria-hidden="true" />
        </h1>
        <p>Here's what's happening with your volunteering journey.</p>
      </div>
      <div className="stats-grid reference-stats">
        {[
          [dashboard.joined, "Drives Joined"],
          [dashboard.hours, "Volunteer Hours"],
          [dashboard.participated, "Activities"],
          [dashboard.certificates, "Certificates"],
        ].map(([value, label]) => (
          <div className="panel reference-stat" key={label}>
            <strong>{value ?? 0}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <section className="overview-profile">
        <h2>My Profile</h2>
        <div className="panel profile-summary">
          <span className="profile-avatar">
            {user.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h3>{user.name}</h3>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Phone:</strong> {profile?.phone || "Not provided"}
            </p>
            <p>
              <strong>Area of Interest:</strong>{" "}
              {profile?.interests?.join(", ") || "Not provided"}
            </p>
            <span className="badge active">Active Volunteer</span>
          </div>
          <Link className="profile-edit" to="/app/profile">
            Edit profile
          </Link>
        </div>
        {profileError && <p className="error">{profileError}</p>}
      </section>
      <section className="overview-drives">
        <div className="section-head">
          <h2>Upcoming Drives</h2>
          <Link to="/app/events" className="text-link">
            View all drives
          </Link>
        </div>
        <State data={events} error={eventsError} />
        <div className="drive-grid">
          {drives?.map((e) => (
            <article className="panel drive-card" key={e._id}>
              <h3>{e.title}</h3>
              <div>
                <CalendarDays size={13} />
                {date(e.date)}
              </div>
              <div>
                <MapPin size={13} />
                {e.location}
              </div>
              <div>
                <Clock size={13} />
                {e.hours} volunteer hours
              </div>
              <p>{e.description}</p>
              <Link className="button small" to={`/app/events?event=${e._id}`}>
                View Details
              </Link>
            </article>
          ))}
        </div>
        {drives?.length === 0 && (
          <Empty>No upcoming drives at the moment. Check back soon.</Empty>
        )}
      </section>
    </div>
  );
}
