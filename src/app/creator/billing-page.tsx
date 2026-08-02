import { useQuery } from "convex/react";
import { Link, Navigate } from "react-router-dom";
import { interviewApi, type PurchaseStatus } from "../../infrastructure/interview-api";
import { primaryButton, secondaryButton } from "../shared/form-controls";
import { creatorCopy } from "./creator-copy";
import { useCreatorLanguage } from "./creator-language";

export const BillingPage = () => <Navigate replace to="/settings#passes" />;

export const BillingSuccessPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  const purchaseId = new URLSearchParams(window.location.search).get("purchase_id") ?? "";
  const purchase = useQuery(
    interviewApi.billing.getPurchaseStatus,
    purchaseId ? { purchaseId } : "skip",
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-9">
        <p className="text-xs font-extrabold tracking-[0.14em] text-forest uppercase">
          {text.interviews.workspace}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{text.billing.successTitle}</h1>
        <p className="mt-4 leading-7 text-muted">{purchaseMessage(purchase, text.billing)}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link className={primaryButton} to="/interviews">{text.billing.backToInterviews}</Link>
          <Link className={secondaryButton} to="/settings#passes">{text.billing.backToPasses}</Link>
        </div>
      </section>
    </main>
  );
};

export const BillingCancelPage = () => {
  const language = useCreatorLanguage();
  const text = creatorCopy[language];
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 lg:py-12" id="main-content">
      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-9">
        <h1 className="font-display text-3xl font-extrabold">{text.billing.cancelledTitle}</h1>
        <p className="mt-4 leading-7 text-muted">{text.billing.cancelledDescription}</p>
        <Link className={`${primaryButton} mt-7`} to="/settings#passes">{text.billing.backToPasses}</Link>
      </section>
    </main>
  );
};

export const purchaseMessage = (
  purchase: PurchaseStatus | null | undefined,
  text: typeof creatorCopy.en.billing | typeof creatorCopy.de.billing,
) => {
  if (purchase === undefined) return text.loading;
  if (!purchase) return text.successPending;
  if (purchase.status === "confirmed") return text.successConfirmed;
  if (purchase.status === "failed") return text.successFailed;
  if (purchase.status === "refunded") return text.successRefunded;
  if (purchase.status === "partial_refund") return text.successPartialRefund;
  return text.successPending;
};
