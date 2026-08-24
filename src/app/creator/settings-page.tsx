import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type FormEvent } from "react";
import { interviewApi } from "../../infrastructure/interview-api";
import { trackEvent } from "../../infrastructure/analytics";
import { Field, primaryButton, Select, TextInput } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import {
  type CreatorLanguage,
  useCreatorLanguage,
  useSetCreatorLanguage,
} from "./creator-language";
import { PassesSection } from "./passes-section";

export const SettingsPage = () => {
  const language = useCreatorLanguage();
  const setCreatorLanguage = useSetCreatorLanguage();
  const text = creatorCopy[language];
  const profile = useQuery(interviewApi.creator_profiles.getCurrent, {});
  const update = useMutation(interviewApi.creator_profiles.updateSettings);
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [contentAnalysisOptIn, setContentAnalysisOptIn] = useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    useState<CreatorLanguage>(language);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setContactEmail(profile.contactEmail ?? "");
      setPrivacyPolicyUrl(profile.privacyPolicyUrl ?? "");
      setContentAnalysisOptIn(profile.contentAnalysisOptIn ?? false);
      const profileLanguage = profile.language ?? "en";
      setSelectedLanguage(profileLanguage);
      setCreatorLanguage(profileLanguage);
    }
  }, [profile, setCreatorLanguage]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await update({
        displayName: displayName.trim(),
        contactEmail: contactEmail.trim(),
        language: selectedLanguage,
        contentAnalysisOptIn,
        ...(privacyPolicyUrl.trim()
          ? { privacyPolicyUrl: privacyPolicyUrl.trim() }
          : {}),
      });
      setCreatorLanguage(selectedLanguage);
      setStatus(creatorCopy[selectedLanguage].settings.saved);
      trackEvent("settings_updated");
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
        <form className="mt-8 grid max-w-3xl gap-5 rounded-box border border-line bg-panel p-6" onSubmit={submit}>
          <Field hint={text.settings.displayNameHint} label={text.settings.displayName}>
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
          <Field
            hint={text.settings.contactEmailHint}
            label={text.settings.contactEmail}
          >
            <TextInput
              onChange={(event) => setContactEmail(event.target.value)}
              required
              type="email"
              value={contactEmail}
            />
          </Field>
          <Field
            hint={text.settings.privacyPolicyUrlHint}
            label={text.settings.privacyPolicyUrl}
          >
            <TextInput
              onChange={(event) => setPrivacyPolicyUrl(event.target.value)}
              type="url"
              value={privacyPolicyUrl}
            />
          </Field>
          <Field
            hint={text.settings.languageHint}
            label={text.settings.language}
          >
            <Select
              onChange={(event) =>
                setSelectedLanguage(event.target.value as CreatorLanguage)
              }
              value={selectedLanguage}
            >
              <option value="en">{text.settings.languageOptions.en}</option>
              <option value="de">{text.settings.languageOptions.de}</option>
            </Select>
          </Field>
          <label className="flex items-start gap-3 rounded-box border border-line bg-soft p-4 text-sm">
            <input
              checked={contentAnalysisOptIn}
              className="mt-1 size-4 accent-[var(--color-primary)]"
              onChange={(event) => setContentAnalysisOptIn(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong className="block">{text.settings.improvement}</strong>
              <span className="mt-1 block leading-6 text-muted">
                {text.settings.improvementHint}
              </span>
            </span>
          </label>
          <div className="flex items-center gap-4">
            <button
              className={primaryButton}
              disabled={
                busy ||
                !displayName.trim() ||
                !contactEmail.trim()
              }
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
