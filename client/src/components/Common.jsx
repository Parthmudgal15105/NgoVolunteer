import {
  CalendarDays,
  Leaf,
  Award,
  HandHeart,
  MapPin,
  Users,
} from "lucide-react";
export const date = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const categoryIcon = (c) =>
  c === "Environment" ? (
    <Leaf />
  ) : c === "Education" ? (
    <Award />
  ) : (
    <HandHeart />
  );
export function State({ data, error }) {
  return error ? (
    <div className="empty error">{error}</div>
  ) : data === null ? (
    <div className="empty">Loading your workspace…</div>
  ) : null;
}
export function Badge({ children }) {
  return <span className={`badge ${children}`}>{children}</span>;
}
export function Empty({
  children = "Nothing here yet. Your next chapter starts with a little action.",
}) {
  return (
    <div className="empty">
      <Leaf size={28} />
      <p>{children}</p>
    </div>
  );
}
export function EventCard({ event, action }) {
  return (
    <article className="event-card">
      <div className="event-body">
        <div className="muted tiny">
          <CalendarDays size={14} />
          {date(event.date)}
          <span>· {event.hours} hours</span>
        </div>
        <h3>{event.title}</h3>
        <Badge>{event.category}</Badge>
        <p className="clamp">{event.description}</p>
        <div className="muted tiny">
          <MapPin size={14} />
          {event.location}
        </div>
        <div className="card-bottom">
          <span className="muted tiny">
            <Users size={14} />
            {event.approvedCount || 0} / {event.capacity} volunteers
          </span>
          {action}
        </div>
      </div>
    </article>
  );
}
