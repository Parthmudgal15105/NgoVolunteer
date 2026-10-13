import { useEffect, useState } from "react";
import api from "./api";
export function useData(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const load = () => {
    setError("");
    if (!path) return Promise.resolve();
    return api
      .get(path)
      .then((r) => setData(r.data))
      .catch((e) =>
        setError(
          e.response?.data?.message ||
            "Unable to connect. Check that the API and MongoDB are running.",
        ),
      );
  };
  useEffect(() => {
    setData(null);
    load();
  }, [path]);
  return { data, error, load };
}
