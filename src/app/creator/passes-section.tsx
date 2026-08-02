import { useAction, useQuery } from "convex/react";
import { CreditCard } from "lucide-react";
import { useState } from "react";
import { interviewApi } from "../../infrastructure/interview-api";
import { primaryButton } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";

export const PassesSection = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const balance = useQuery(interviewApi.billing.getBalance, {});
  const createCheckout = useAction(interviewApi.billing.createCheckoutSession);
  const [busyPack, setBusyPack] = useState<"one_pass" | "five_passes" | "">("");
  const [error, setError] = useState("");

  const buy = async (packId: "one_pass" | "five_passes") => {
    if (busyPack) return;
    setBusyPack(packId);
    setError("");
    try {
      const result = await createCheckout({ packId });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text.billing.checkoutError);
      setBusyPack("");
    }
  };

  return (
    <section id="passes">
      <header className="max-w-3xl">
        <h2 className="font-display text-3xl font-extrabold">{text.billing.title}</h2>
        <p className="mt-3 leading-7 text-muted">{text.billing.intro}</p>
      </header>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BalanceCard label={text.billing.available} value={balance?.availablePasses ?? 0} />
        <BalanceCard label={text.billing.reserved} value={balance?.reservedPasses ?? 0} />
        <BalanceCard label={text.billing.introductory} value={balance?.introductoryPasses ?? 0} />
        <BalanceCard label={text.billing.purchased} value={balance?.purchasedPasses ?? 0} />
      </div>
      <p className="mt-4 text-sm font-bold text-muted">{text.billing.nonExpiring}</p>
      {error ? (
        <p className="mt-5 rounded-lg border border-error-border bg-error-surface p-4 font-bold text-error-text" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <PackCard
          busy={busyPack === "one_pass"}
          description={text.billing.buyOneDescription}
          disabled={Boolean(busyPack)}
          onBuy={() => void buy("one_pass")}
          price="€29"
          title={text.billing.buyOneTitle}
          button={text.billing.buyOne}
          busyLabel={text.billing.redirecting}
          taxes={text.billing.taxes}
        />
        <PackCard
          busy={busyPack === "five_passes"}
          description={text.billing.buyFiveDescription}
          disabled={Boolean(busyPack)}
          onBuy={() => void buy("five_passes")}
          price="€99"
          title={text.billing.buyFiveTitle}
          button={text.billing.buyFive}
          busyLabel={text.billing.redirecting}
          taxes={text.billing.taxes}
        />
      </div>
    </section>
  );
};

const BalanceCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-box border border-line bg-panel p-5">
    <p className="text-sm font-bold text-muted">{label}</p>
    <p className="mt-2 font-display text-4xl font-extrabold text-forest">{value}</p>
  </div>
);

const PackCard = ({
  title,
  description,
  price,
  button,
  busyLabel,
  taxes,
  busy,
  disabled,
  onBuy,
}: {
  title: string;
  description: string;
  price: string;
  button: string;
  busyLabel: string;
  taxes: string;
  busy: boolean;
  disabled: boolean;
  onBuy(): void;
}) => (
  <article className="flex flex-col rounded-box border border-line bg-panel p-6 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="font-display text-2xl font-extrabold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>
      <CreditCard aria-hidden="true" className="shrink-0 text-forest" size={22} />
    </div>
    <p className="mt-7 font-display text-4xl font-extrabold">{price}</p>
    <p className="mt-1 text-sm text-muted">{taxes}</p>
    <button
      className={`${primaryButton} mt-7 w-full`}
      disabled={disabled}
      onClick={onBuy}
      type="button"
    >
      {busy ? busyLabel : button}
    </button>
  </article>
);
