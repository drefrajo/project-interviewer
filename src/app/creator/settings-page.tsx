import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { interviewApi } from "../../infrastructure/interview-api";
import { Field, primaryButton, TextInput } from "../shared/form-controls";

export const SettingsPage = () => {
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const update = useMutation(
    interviewApi.creator_profiles.updateDisplayName,
  );
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile) setDisplayName(profile.displayName);
  }, [profile]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await update({ displayName: displayName.trim() });
      setStatus("Settings saved.");
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <h1 className="font-display text-4xl font-extrabold">Settings</h1>
      <p className="mt-3 leading-7 text-muted">
        This identity is shown to Clients so they can verify who invited them.
      </p>
      <form className="mt-8 grid gap-5 rounded-xl border border-line bg-surface p-6" onSubmit={submit}>
        <Field label="Business or display name">
          <TextInput
            maxLength={120}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </Field>
        <Field
          hint="Your verified identity cannot be changed here."
          label="Verified email"
        >
          <TextInput disabled readOnly value={profile?.email ?? ""} />
        </Field>
        <div className="flex items-center gap-4">
          <button
            className={primaryButton}
            disabled={busy || !displayName.trim()}
            type="submit"
          >
            Save settings
          </button>
          {status ? (
            <p className="text-sm font-bold text-muted" role="status">
              {status}
            </p>
          ) : null}
        </div>
      </form>
    </main>
  );
};

