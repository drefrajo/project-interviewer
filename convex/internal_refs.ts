import { makeFunctionReference } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";

export type DownloadManifest = {
  projectName: string;
  projectDocument: string;
  visualDirection: Doc<"interviews">["submission"] extends
    | { visualDirection: infer Direction }
    | undefined
    ? Direction
    : never;
  transcript: string;
  concepts: Array<{
    id: string;
    name: string;
    rationale: string;
    imageId?: Id<"_storage">;
  }>;
};

export const internalRefs = {
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
      { storageId: Id<"_storage"> },
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
  },
  billing: {
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
          priceId: string;
          passCount: 1 | 5;
          amountMinor: 2900 | 9900;
          currency: "eur";
        };
        stripeCustomerId?: string;
        checkoutUrl?: string;
      }
    >("billing:preparePurchase"),
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
};
