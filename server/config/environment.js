export function validateEnvironment(env = process.env) {
  if (
    !env.JWT_SECRET ||
    env.JWT_SECRET.length < 32 ||
    env.JWT_SECRET.startsWith("replace-with-")
  ) {
    throw new Error(
      "Set JWT_SECRET to a unique random secret of at least 32 characters.",
    );
  }
  if (env.TRUST_PROXY && !/^[0-9]+$/.test(env.TRUST_PROXY)) {
    throw new Error("TRUST_PROXY must be a non-negative proxy hop count.");
  }
  if (env.NODE_ENV !== "production") return;
  if (!env.MONGODB_URI || !/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI)) {
    throw new Error("Set MONGODB_URI for the production database.");
  }
  // Atlas SRV connections enable TLS by default. Never permit disabling it.
  if (/[?&](?:tls|ssl)=false(?:&|$)/i.test(env.MONGODB_URI)) {
    throw new Error("Production database connections must use TLS.");
  }
  if (
    !env.MONGODB_URI.startsWith("mongodb+srv://") &&
    !/[?&](?:tls|ssl)=true(?:&|$)/i.test(env.MONGODB_URI)
  ) {
    throw new Error(
      "Use an Atlas SRV URI or explicitly enable TLS in production.",
    );
  }
  let origin;
  try {
    origin = new URL(env.CLIENT_ORIGIN);
  } catch {
    throw new Error("Set CLIENT_ORIGIN to the HTTPS frontend origin.");
  }
  if (
    origin.protocol !== "https:" ||
    origin.origin !== env.CLIENT_ORIGIN ||
    origin.username ||
    origin.password
  ) {
    throw new Error(
      "CLIENT_ORIGIN must be an exact HTTPS origin without a trailing slash or path.",
    );
  }
}
