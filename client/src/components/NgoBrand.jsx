import { Link } from "react-router-dom";
export default function NgoBrand({ compact = false }) {
  return (
    <Link className={`brand ngo-brand${compact ? " compact" : ""}`} to="/">
      <img src="/brand/ngo-logo.jpeg" alt="Warriors Without Cause NGO logo" />
      <span>
        Warriors
        <br />
        Without Cause
      </span>
    </Link>
  );
}
