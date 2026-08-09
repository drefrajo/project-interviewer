import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";

export type DownloadManifest = {
  projectName: string;
  projectDocument?: string;
  visualDirectionJson?: string;
  transcriptMarkdown: string;
  transcriptJson: string;
  interviewJson: string;
  concepts: Array<{
    id: string;
    name: string;
    rationale: string;
    prompt: string;
    imageId?: Id<"_storage">;
  }>;
};

export const internalRefs = {
  retention: {
    backfillDeadlines: makeFunctionReference<
      "mutation",
      { limit: number },
      number
    >("retention:backfillDeadlines"),
    getExpired: makeFunctionReference<
      "query",
      { now: number; limit: number },
      Array<{ interviewId: Id<"interviews"> }>
    >("retention:getExpired"),
    getWarnings: makeFunctionReference<
      "query",
      { now: number; limit: number },
      Array<{
        interviewId: Id<"interviews">;
        projectName: string;
        retentionExpiresAt: number;
        creatorEmail: string;
        creatorName: string;
        creatorLanguage: "en" | "de";
      }>
    >("retention:getWarnings"),
    recordWarningAttempt: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        retentionExpiresAt: number;
        attemptedAt: number;
        delivered: boolean;
      },
      boolean
    >("retention:recordWarningAttempt"),
    deleteExpired: makeFunctionReference<
      "mutation",
      { interviewId: Id<"interviews">; now: number },
      boolean
    >("retention:deleteExpired"),
    runSweep: makeFunctionReference<
      "action",
      Record<string, never>,
      { backfilled: number; deleted: number; warningsSent: number }
    >("retention:runSweep"),
  },
  jobs: {
    runPending: makeFunctionReference<
      "action",
      { interviewId: Id<"interviews"> },
      null
    >("jobs:runPending"),
    begin: makeFunctionReference<
      "mutation",
      { interviewId: Id<"interviews"> },
      {
        interview: Doc<"interviews">;
        creator: Doc<"creatorProfiles">;
      } | null
    >("jobs:begin"),
    saveInterviewPlan: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        interviewPlan: string;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
      },
      null
    >("jobs:saveInterviewPlan"),
    setConceptGenerationPhase: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        phase: "concept_planning" | "concept_creating";
      },
      null
    >("jobs:setConceptGenerationPhase"),
    completeText: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        kind: "interview_response" | "document_revision";
        interviewTurnKind?:
          | "question"
          | "alignment"
          | "ready"
          | "document";
        assistantContent?: string;
        projectDocument?: string;
        suggestedReplies?: string[];
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
      },
      null
    >("jobs:completeText"),
    completeConcepts: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        concepts: Doc<"interviews">["concepts"];
        hasFailure: boolean;
        errorCode?: string;
      },
      null
    >("jobs:completeConcepts"),
    completeEmail: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        delivery: "sent" | "failed" | "unknown";
      },
      null
    >("jobs:completeEmail"),
    fail: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        errorCode: string;
        ambiguous: boolean;
      },
      null
    >("jobs:fail"),
  },
  downloads: {
    cleanup: makeFunctionReference<
      "action",
      { archiveId: Id<"exportArchives"> },
      null
    >("downloads:cleanup"),
  },
  downloadsData: {
    get: makeFunctionReference<
      "query",
      {
        interviewId: Id<"interviews">;
        tokenIdentifier: string;
      },
      DownloadManifest | null
    >("downloads_data:get"),
    registerArchive: makeFunctionReference<
      "mutation",
      {
        interviewId: Id<"interviews">;
        tokenIdentifier: string;
        storageId: Id<"_storage">;
        expiresAt: number;
      },
      Id<"exportArchives"> | null
    >("downloads_data:registerArchive"),
    getArchive: makeFunctionReference<
      "query",
      { archiveId: Id<"exportArchives"> },
      { storageId: Id<"_storage"> } | null
    >("downloads_data:getArchive"),
    removeArchive: makeFunctionReference<
      "mutation",
      { archiveId: Id<"exportArchives"> },
      null
    >("downloads_data:removeArchive"),
  },
  billing: {
    syncCatalog: makeFunctionReference<
      "action",
      Record<string, never>,
      { syncedAt: number; packCount: number }
    >("billing:syncCatalog"),
    replaceCatalog: makeFunctionReference<
      "mutation",
      {
        items: Array<{
          packId: "one_pass" | "five_passes";
          lookupKey: string;
          priceId: string;
          productId: string;
          passCount: 1 | 5;
          amountMinor: number;
          currency: "eur";
          active: boolean;
          syncedAt: number;
        }>;
      },
      null
    >("billing:replaceCatalog"),
    preparePurchase: makeFunctionReference<
      "mutation",
      { packId: "one_pass" | "five_passes" },
      {
        purchaseId: string;
        purchaseDocId: Id<"purchases">;
        creatorId: Id<"creatorProfiles">;
        creatorEmail: string;
        creatorName: string;
        pack: {
          id: "one_pass" | "five_passes";
          label: string;
          lookupKey: string;
          priceId: string;
          productId: string;
          passCount: 1 | 5;
          amountMinor: number;
          currency: "eur";
        };
        stripeCustomerId?: string;
        checkoutUrl?: string;
      }
    >("billing:preparePurchase"),
    refreshPendingPurchaseCatalog: makeFunctionReference<
      "mutation",
      {
        purchaseId: Id<"purchases">;
        lookupKey: string;
        priceId: string;
        amountMinor: number;
      },
      null
    >("billing:refreshPendingPurchaseCatalog"),
    attachCustomer: makeFunctionReference<
      "mutation",
      { purchaseId: Id<"purchases">; customerId: string },
      null
    >("billing:attachCustomer"),
    attachCheckoutSession: makeFunctionReference<
      "mutation",
      {
        purchaseId: Id<"purchases">;
        checkoutSessionId: string;
        checkoutUrl: string;
        paymentIntentId?: string;
        customerId?: string;
      },
      null
    >("billing:attachCheckoutSession"),
    failPendingPurchase: makeFunctionReference<
      "mutation",
      { purchaseId: Id<"purchases"> },
      null
    >("billing:failPendingPurchase"),
    handleWebhook: makeFunctionReference<
      "mutation",
      {
        event: {
          eventId: string;
          eventType:
            | "price.created"
            | "price.updated"
            | "checkout.session.completed"
            | "checkout.session.async_payment_succeeded"
            | "checkout.session.async_payment_failed"
            | "charge.refunded"
            | "refund.created"
            | "charge.dispute.created"
            | "charge.dispute.closed"
            | "charge.dispute.funds_reinstated"
            | "charge.dispute.funds_withdrawn";
          objectId: string;
          purchaseId?: string;
          paymentStatus?: string;
          sessionStatus?: string;
          paymentIntentId?: string;
          customerId?: string;
          chargeId?: string;
          amount?: number;
          amountRefunded?: number;
          disputeStatus?: string;
          lookupKey?: string;
          priceId?: string;
          productId?: string;
          priceActive?: boolean;
          priceCurrency?: string;
          priceUnitAmount?: number;
        };
      },
      { state: "processed" | "ignored" | "deferred" }
    >("billing:handleWebhook"),
    ledgerPage: makeFunctionReference<
      "query",
      {
        creatorId: Id<"creatorProfiles">;
        paginationOpts: {
          numItems: number;
          cursor: string | null;
          endCursor?: string;
          maximumRowsRead?: number;
          maximumBytesRead?: number;
          id?: number;
        };
      },
      {
        page: Array<Doc<"passLedger">>;
        isDone: boolean;
        continueCursor: string;
      }
    >("billing:ledgerPage"),
    accountSnapshot: makeFunctionReference<
      "query",
      { creatorId: Id<"creatorProfiles"> },
      Doc<"passAccounts"> | null
    >("billing:accountSnapshot"),
    purchaseReconciliationPage: makeFunctionReference<
      "query",
      {
        creatorId: Id<"creatorProfiles">;
        paginationOpts: {
          numItems: number;
          cursor: string | null;
          endCursor?: string;
          maximumRowsRead?: number;
          maximumBytesRead?: number;
          id?: number;
        };
      },
      {
        page: Array<{
          purchase: Doc<"purchases">;
          ledgerKeys: string[];
        }>;
        isDone: boolean;
        continueCursor: string;
      }
    >("billing:purchaseReconciliationPage"),
  },
  legal: {
    latestAcceptance: makeFunctionReference<
      "query",
      Record<string, never>,
      {
        termsVersion: number;
        dpaVersion: number;
        termsHash: string;
        dpaHash: string;
      } | null
    >("legal:latestAcceptance"),
    recordAcceptance: makeFunctionReference<
      "mutation",
      {
        termsVersion: number;
        dpaVersion: number;
        termsHash: string;
        dpaHash: string;
      },
      null
    >("legal:recordAcceptance"),
  },
};
