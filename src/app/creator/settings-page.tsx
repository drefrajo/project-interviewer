import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { interviewApi } from "../../infrastructure/interview-api";
import { Field, primaryButton, TextInput } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";
import { PassesSection } from "./passes-section";

export const SettingsPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
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
      setStatus(text.settings.saved);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <PassesSection />
      <section className="mt-12 border-t border-line pt-8" id="settings-profile">
        <h1 className="font-display text-4xl font-extrabold">
          {text.settings.title}
        </h1>
        <p className="mt-3 leading-7 text-muted">
          {text.settings.intro}
        </p>
        <form className="mt-8 grid max-w-3xl gap-5 rounded-xl border border-line bg-surface p-6" onSubmit={submit}>
          <Field label={text.settings.displayName}>
            <TextInput
              maxLength={120}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              value={displayName}
            />
          </Field>
          <Field
            hint={text.settings.emailHint}
            label={text.settings.email}
          >
            <TextInput
              className="disabled:cursor-not-allowed disabled:bg-soft disabled:text-muted disabled:opacity-75"
              disabled
              readOnly
              value={profile?.email ?? ""}
            />
          </Field>
          <div className="flex items-center gap-4">
            <button
              className={primaryButton}
              disabled={busy || !displayName.trim()}
              type="submit"
            >
              {text.settings.save}
            </button>
            {status ? (
              <p className="text-sm font-bold text-muted" role="status">
                {status}
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
};
