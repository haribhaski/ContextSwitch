"use client";

import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { useMemo, useState } from "react";

import {
  authorizedFetch,
  responseJson,
} from "@/lib/api-client";

/* =========================================================
   TYPES
========================================================= */

export type ImportedContextItem = {
  id: string;

  type:
    | "decision"
    | "micro_decision"
    | "completed"
    | "failure"
    | "rejected_alternative"
    | "assumption"
    | "constraint"
    | "blocker"
    | "open_question"
    | "todo"
    | "technical_discovery"
    | "dependency"
    | "architecture_change"
    | "do_not_repeat"
    | "risk_flag"
    | "idea";

  title: string;

  content: string;

  reason?: string | null;

  evidence?: string | null;

  confidence: number;

  explicitness?: "explicit" | "inferred";

  severity?:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | null;

  likelihood?:
    | "low"
    | "medium"
    | "high"
    | null;

  impact?: string | null;

  what_breaks_if_false?: string | null;

  validation_step?: string | null;

  alternatives?: string[];

  tags?: string[];

  approved?: boolean;
};

type ImportAnalysis = {
  import_id: string;

  source: "gemini";

  source_url: string;

  worker_id: string;

  worker_name?: string | null;

  conversation_title?: string | null;

  summary?: string | null;

  items: ImportedContextItem[];

  counts: Record<string, number>;
};

type Member = {
  id?: string;

  worker_id: string;

  name: string;

  email?: string;
};

type Props = {
  isOpen: boolean;

  onClose: () => void;

  teamId: string;

  projectId: string;

  members: Member[];

  defaultWorkerId?: string;

  onImported?: () => void;
};

/* =========================================================
   EXTRACTION TYPES
========================================================= */

const EXTRACTION_LABELS = [
  ["decision", "Decisions"],
  ["micro_decision", "Micro-decisions"],
  ["completed", "Completed work"],
  ["failure", "Failed attempts"],
  ["rejected_alternative", "Rejected alternatives"],
  ["assumption", "Assumptions"],
  ["constraint", "Constraints"],
  ["blocker", "Blockers"],
  ["open_question", "Open questions"],
  ["todo", "TODOs / next actions"],
  ["technical_discovery", "Technical discoveries"],
  ["dependency", "Dependencies"],
  ["architecture_change", "Architecture changes"],
  ["do_not_repeat", "Do-not-repeat lessons"],
  ["risk_flag", "Risk flags"],
  ["idea", "Ideas / suggestions"],
] as const;

/* =========================================================
   HELPERS
========================================================= */

function pct(value: number) {
  return `${Math.round(
    Math.max(0, Math.min(1, value)) * 100
  )}%`;
}

function typeStyle(
  type: ImportedContextItem["type"]
) {
  if (type === "risk_flag") {
    return "border-red-500/30 bg-red-500/5 text-red-300";
  }

  if (type === "assumption") {
    return "border-amber-500/30 bg-amber-500/5 text-amber-200";
  }

  if (type === "open_question") {
    return "border-violet-500/30 bg-violet-500/5 text-violet-200";
  }

  if (
    type === "decision" ||
    type === "micro_decision"
  ) {
    return "border-emerald-500/30 bg-emerald-500/5 text-emerald-200";
  }

  return "border-[#2a3040] bg-[#11141c] text-[#cbd5e1]";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ImportAIContextModal({
  isOpen,
  onClose,
  teamId,
  projectId,
  members,
  defaultWorkerId,
  onImported,
}: Props) {
  /* =======================================================
     STATE
  ======================================================= */

  const [url, setUrl] = useState("");

  const [workerId, setWorkerId] = useState(
    defaultWorkerId ||
      members[0]?.worker_id ||
      ""
  );

  const [
    selectedTypes,
    setSelectedTypes,
  ] = useState<string[]>(
    EXTRACTION_LABELS.map(
      ([key]) => key
    )
  );

  const [
    analysis,
    setAnalysis,
  ] = useState<ImportAnalysis | null>(
    null
  );

  const [
    analyzing,
    setAnalyzing,
  ] = useState(false);

  const [
    approving,
    setApproving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const approvedCount = useMemo(
    () =>
      analysis?.items.filter(
        (item) =>
          item.approved !== false
      ).length ?? 0,
    [analysis]
  );

  /* =======================================================
     CLOSED
  ======================================================= */

  if (!isOpen) {
    return null;
  }

  /* =======================================================
     CLOSE
  ======================================================= */

  function resetAndClose() {
    if (
      analyzing ||
      approving
    ) {
      return;
    }

    setUrl("");

    setAnalysis(null);

    setError(null);

    onClose();
  }

  /* =======================================================
     TOGGLE EXTRACTION
  ======================================================= */

  function toggleType(type: string) {
    setSelectedTypes(
      (previous) =>
        previous.includes(type)
          ? previous.filter(
              (value) =>
                value !== type
            )
          : [
              ...previous,
              type,
            ]
    );
  }

  /* =======================================================
     ANALYZE
  ======================================================= */

  async function analyze() {
    const trimmed =
      url.trim();

    setError(null);

    if (!trimmed) {
      setError(
        "Paste your Gemini share link first."
      );

      return;
    }

    if (
      !/^https:\/\/share\.gemini\.google\/[A-Za-z0-9_-]+\/?$/i.test(
        trimmed
      )
    ) {
      setError(
        "Paste a valid Gemini public share link like https://share.gemini.google/u6QHQZhANgrA"
      );
      return;
    }

    if (!workerId) {
      setError(
        "Choose which teammate this conversation belongs to."
      );

      return;
    }

    if (
      selectedTypes.length === 0
    ) {
      setError(
        "Choose at least one context type to extract."
      );

      return;
    }

    setAnalyzing(true);

    try {
      const response =
        await authorizedFetch(
          `/teams/${teamId}/projects/${projectId}/imports/chat/analyze`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              source: "gemini",

              url: trimmed,

              worker_id:
                workerId,

              extract:
                selectedTypes,
            }),
          }
        );

      const data =
        await responseJson<ImportAnalysis>(
          response
        );

      setAnalysis({
        ...data,

        items:
          data.items.map(
            (item) => ({
              ...item,

              approved: true,
            })
          ),
      });
    } catch (err) {
      console.error(
        "Gemini import analysis failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gemini conversation analysis failed."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  /* =======================================================
     TOGGLE APPROVAL
  ======================================================= */

  function toggleApproved(
    id: string
  ) {
    setAnalysis(
      (previous) =>
        previous
          ? {
              ...previous,

              items:
                previous.items.map(
                  (item) =>
                    item.id === id
                      ? {
                          ...item,

                          approved:
                            item.approved ===
                            false,
                        }
                      : item
                ),
            }
          : previous
    );
  }

  /* =======================================================
     APPROVE / MERGE
  ======================================================= */

  async function approve() {
    if (!analysis) {
      return;
    }

    const approvedIds =
      analysis.items
        .filter(
          (item) =>
            item.approved !==
            false
        )
        .map(
          (item) => item.id
        );

    if (
      approvedIds.length === 0
    ) {
      setError(
        "Keep at least one extracted item before importing."
      );

      return;
    }

    setApproving(true);

    setError(null);

    try {
      const response =
        await authorizedFetch(
          `/teams/${teamId}/projects/${projectId}/imports/${analysis.import_id}/approve`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                approved_item_ids:
                  approvedIds,
              }),
          }
        );

      await responseJson(
        response
      );

      onImported?.();

      resetAndClose();
    } catch (err) {
      console.error(
        "Import merge failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to merge imported context."
      );
    } finally {
      setApproving(false);
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/80
        p-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          resetAndClose();
        }
      }}
    >
      <div
        className="
          max-h-[92vh]
          w-full
          max-w-3xl
          overflow-hidden
          rounded-2xl
          border
          border-[#2a3040]
          bg-[#161a24]
          text-[#e1e7ef]
          shadow-2xl
        "
      >
        {/* =================================================
            HEADER
        ================================================= */}

        <div
          className="
            flex
            items-start
            justify-between
            gap-4
            border-b
            border-[#222734]
            px-6
            py-5
          "
        >
          <div>
            <div
              className="
                flex
                items-center
                gap-2
                text-lg
                font-semibold
                text-white
              "
            >
              <Brain
                className="
                  h-5
                  w-5
                  text-[#a78bfa]
                "
              />

              Import from Gemini
            </div>

            <p
              className="
                mt-1
                max-w-xl
                text-xs
                leading-5
                text-[#64748b]
              "
            >
              Paste a public Gemini
              conversation link and
              bring its useful project
              context into
              ContextSwitch.
            </p>
          </div>

          <button
            onClick={
              resetAndClose
            }
            disabled={
              analyzing ||
              approving
            }
            className="
              rounded-lg
              p-2
              text-[#94a3b8]
              transition
              hover:bg-[#222734]
              hover:text-white
              disabled:opacity-40
            "
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* =================================================
            BODY
        ================================================= */}

        <div
          className="
            max-h-[calc(92vh-78px)]
            overflow-y-auto
            p-6
          "
        >
          {!analysis ? (
            /* =================================================
               STEP 1 — PASTE LINK
            ================================================= */

            <div className="space-y-5">
              {/* =============================================
                  LINK BOX
              ============================================= */}

              <div
                className="
                  rounded-2xl
                  border
                  border-[#334155]
                  bg-[#11141c]
                  p-5
                "
              >
                <div className="mb-4">
                  <h2
                    className="
                      text-base
                      font-semibold
                      text-white
                    "
                  >
                    Paste Gemini
                    conversation
                  </h2>

                  <p
                    className="
                      mt-1
                      text-xs
                      leading-5
                      text-[#64748b]
                    "
                  >
                    In Gemini, open
                    Share conversation,
                    create a public link
                    and paste it here.
                  </p>
                </div>

                <label
                  className="
                    mb-2
                    block
                    text-xs
                    font-semibold
                    text-[#cbd5e1]
                  "
                >
                  Gemini share link
                </label>

                <div
                  className="
                    flex
                    flex-col
                    gap-2
                    sm:flex-row
                  "
                >
                  <div
                    className="
                      relative
                      flex-1
                    "
                  >
                    <Link2
                      className="
                        absolute
                        left-4
                        top-1/2
                        h-5
                        w-5
                        -translate-y-1/2
                        text-[#64748b]
                      "
                    />

                    <input
                      autoFocus
                      value={url}
                      onChange={(
                        event
                      ) => {
                        setUrl(
                          event.target
                            .value
                        );

                        setError(
                          null
                        );
                      }}
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                            "Enter" &&
                          url.trim() &&
                          workerId
                        ) {
                          void analyze();
                        }
                      }}
                      placeholder="https://g.co/gemini/share/..."
                      className="
                        h-12
                        w-full
                        rounded-xl
                        border
                        border-[#334155]
                        bg-[#0f1117]
                        pl-12
                        pr-4
                        text-sm
                        text-white
                        outline-none
                        transition
                        placeholder:text-[#475569]
                        focus:border-[#38bdf8]
                        focus:ring-2
                        focus:ring-[#38bdf8]/10
                      "
                    />
                  </div>

                  {url.trim() && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        flex
                        h-12
                        shrink-0
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-[#334155]
                        bg-[#161a24]
                        px-4
                        text-xs
                        font-medium
                        text-[#cbd5e1]
                        transition
                        hover:bg-[#1e293b]
                        hover:text-white
                      "
                    >
                      Open Link

                      <ExternalLink
                        className="
                          h-4
                          w-4
                        "
                      />
                    </a>
                  )}
                </div>

                <p
                  className="
                    mt-2
                    text-[11px]
                    text-[#64748b]
                  "
                >
                  Only public Gemini
                  share links are
                  accepted.
                </p>
              </div>

              {/* =============================================
                  TEAM MEMBER
              ============================================= */}

              <div
                className="
                  rounded-2xl
                  border
                  border-[#2a3040]
                  bg-[#11141c]
                  p-5
                "
              >
                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-medium
                    text-white
                  "
                >
                  <UserRound
                    className="
                      h-4
                      w-4
                      text-[#94a3b8]
                    "
                  />

                  Whose conversation is
                  this?
                </label>

                <p
                  className="
                    mt-1
                    text-xs
                    text-[#64748b]
                  "
                >
                  The extracted context
                  will be attributed to
                  this teammate.
                </p>

                <select
                  value={
                    workerId
                  }
                  onChange={(
                    event
                  ) => {
                    setWorkerId(
                      event.target
                        .value
                    );

                    setError(
                      null
                    );
                  }}
                  className="
                    mt-4
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-[#334155]
                    bg-[#0f1117]
                    px-3
                    text-sm
                    text-white
                    outline-none
                    transition
                    focus:border-[#38bdf8]
                  "
                >
                  <option value="">
                    Select teammate
                  </option>

                  {members.map(
                    (member) => (
                      <option
                        key={
                          member.worker_id
                        }
                        value={
                          member.worker_id
                        }
                      >
                        {member.name ||
                          member.worker_id}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* =============================================
                  ADVANCED OPTIONS
              ============================================= */}

              <details
  className="
    rounded-2xl
    border
    border-[#222734]
    bg-[#11141c]
  "
>
  <summary
    className="
      cursor-pointer
      select-none
      list-none
      px-5
      py-4
      text-sm
      font-medium
      text-[#94a3b8]
      hover:text-white
      [&::-webkit-details-marker]:hidden
    "
  >
    Advanced extraction
    options
  </summary>

  <div
    className="
      border-t
      border-[#222734]
      p-5
    "
  >
    <div
      className="
        mb-4
        flex
        items-start
        gap-3
        rounded-xl
        border
        border-amber-500/20
        bg-amber-500/5
        p-4
      "
    >
      <AlertTriangle
        className="
          mt-0.5
          h-4
          w-4
          shrink-0
          text-amber-300
        "
      />

      <div>
        <p
          className="
            text-xs
            font-semibold
            text-amber-200
          "
        >
          Context extraction
        </p>

        <p
          className="
            mt-1
            text-[11px]
            leading-5
            text-[#b8a978]
          "
        >
          By default,
          ContextSwitch
          extracts all
          useful decisions,
          assumptions,
          blockers,
          failures, risks
          and next actions.
        </p>
      </div>
    </div>

    <div
      className="
        grid
        gap-2
        sm:grid-cols-2
        lg:grid-cols-3
      "
    >
      {EXTRACTION_LABELS.map(
        ([key, label]) => {
          const checked =
            selectedTypes.includes(
              key
            );

          return (
            <button
              type="button"
              key={key}
              onClick={() =>
                toggleType(key)
              }
              className={`
                flex
                min-h-11
                items-center
                justify-between
                gap-3
                rounded-lg
                border
                px-3
                py-2.5
                text-left
                text-xs

                ${
                  checked
                    ? "border-[#2563eb]/50 bg-[#2563eb]/10 text-white"
                    : "border-[#2a3040] bg-[#0f1117] text-[#94a3b8] hover:border-[#334155]"
                }
              `}
            >
              <span>
                {label}
              </span>

              {checked && (
                <CheckCircle2
                  className="
                    h-4
                    w-4
                    shrink-0
                    text-[#38bdf8]
                  "
                />
              )}
            </button>
          );
        }
      )}
    </div>
  </div>
</details>

              {/* =============================================
                  ERROR
              ============================================= */}

              {error && (
                <div
                  className="
                    rounded-xl
                    border
                    border-red-500/30
                    bg-red-500/10
                    p-3
                    text-xs
                    leading-5
                    text-red-300
                  "
                >
                  {error}
                </div>
              )}

              {/* =============================================
                  BUTTONS
              ============================================= */}

              <div
                className="
                  flex
                  flex-col-reverse
                  justify-between
                  gap-3
                  border-t
                  border-[#222734]
                  pt-5
                  sm:flex-row
                  sm:items-center
                "
              >
                <button
                  onClick={
                    resetAndClose
                  }
                  disabled={
                    analyzing
                  }
                  className="
                    rounded-xl
                    px-4
                    py-2.5
                    text-xs
                    font-medium
                    text-[#94a3b8]
                    transition
                    hover:bg-[#1e293b]
                    hover:text-white
                    disabled:opacity-50
                  "
                >
                  Cancel
                </button>

                <button
                  onClick={() =>
                    void analyze()
                  }
                  disabled={
                    analyzing ||
                    !url.trim() ||
                    !workerId
                  }
                  className="
                    flex
                    h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#2563eb]
                    px-6
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-[#1d4ed8]
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  {analyzing ? (
                    <Loader2
                      className="
                        h-4
                        w-4
                        animate-spin
                      "
                    />
                  ) : (
                    <Sparkles
                      className="
                        h-4
                        w-4
                      "
                    />
                  )}

                  {analyzing
                    ? "Analyzing conversation..."
                    : "Analyze Conversation"}
                </button>
              </div>
            </div>
          ) : (
            /* =================================================
               STEP 2 — REVIEW RESULT
            ================================================= */

            <div className="space-y-5">
              {/* =============================================
                  SUMMARY
              ============================================= */}

              <div
                className="
                  rounded-2xl
                  border
                  border-[#2a3040]
                  bg-[#11141c]
                  p-5
                "
              >
                <div
                  className="
                    flex
                    flex-wrap
                    items-start
                    justify-between
                    gap-4
                  "
                >
                  <div>
                    <div
                      className="
                        text-base
                        font-semibold
                        text-white
                      "
                    >
                      {analysis.conversation_title ||
                        "Imported Gemini conversation"}
                    </div>

                    <div
                      className="
                        mt-2
                        flex
                        flex-wrap
                        items-center
                        gap-2
                        text-xs
                        text-[#64748b]
                      "
                    >
                      <span>
                        Member:
                      </span>

                      <span
                        className="
                          rounded-md
                          bg-[#1e293b]
                          px-2
                          py-1
                          text-[#38bdf8]
                        "
                      >
                        {analysis.worker_name ||
                          analysis.worker_id}
                      </span>

                      <span>
                        {
                          analysis
                            .items
                            .length
                        }{" "}
                        context items
                      </span>
                    </div>
                  </div>

                  <div
                    className="
                      rounded-lg
                      border
                      border-[#334155]
                      bg-[#0f1117]
                      px-3
                      py-2
                      text-xs
                      text-[#94a3b8]
                    "
                  >
                    <span
                      className="
                        font-semibold
                        text-white
                      "
                    >
                      {approvedCount}
                    </span>

                    {" / "}

                    {
                      analysis.items
                        .length
                    }

                    {" selected"}
                  </div>
                </div>

                {analysis.summary && (
                  <p
                    className="
                      mt-4
                      text-sm
                      leading-6
                      text-[#94a3b8]
                    "
                  >
                    {
                      analysis.summary
                    }
                  </p>
                )}
              </div>

              {/* =============================================
                  COUNTS
              ============================================= */}

              {Object.keys(
                analysis.counts ||
                  {}
              ).length > 0 && (
                <div
                  className="
                    grid
                    gap-2
                    sm:grid-cols-2
                    lg:grid-cols-4
                  "
                >
                  {Object.entries(
                    analysis.counts ||
                      {}
                  ).map(
                    ([
                      key,
                      count,
                    ]) => (
                      <div
                        key={
                          key
                        }
                        className="
                          rounded-xl
                          border
                          border-[#2a3040]
                          bg-[#11141c]
                          p-3
                        "
                      >
                        <div
                          className="
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-wider
                            text-[#64748b]
                          "
                        >
                          {key.replaceAll(
                            "_",
                            " "
                          )}
                        </div>

                        <div
                          className="
                            mt-1
                            text-lg
                            font-semibold
                            text-white
                          "
                        >
                          {
                            count
                          }
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* =============================================
                  EXTRACTED ITEMS
              ============================================= */}

              <div className="space-y-3">
                {analysis.items.map(
                  (item) => (
                    <div
                      key={
                        item.id
                      }
                      className={`
                        rounded-xl
                        border
                        p-4
                        transition

                        ${typeStyle(
                          item.type
                        )}

                        ${
                          item.approved ===
                          false
                            ? "opacity-40"
                            : ""
                        }
                      `}
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-4
                        "
                      >
                        <div>
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <span
                              className="
                                text-[10px]
                                font-bold
                                uppercase
                                tracking-wider
                              "
                            >
                              {item.type.replaceAll(
                                "_",
                                " "
                              )}
                            </span>

                            {item.explicitness && (
                              <span
                                className="
                                  rounded
                                  bg-black/20
                                  px-2
                                  py-0.5
                                  text-[10px]
                                  uppercase
                                "
                              >
                                {
                                  item.explicitness
                                }
                              </span>
                            )}

                            {item.severity && (
                              <span
                                className="
                                  rounded
                                  bg-red-500/15
                                  px-2
                                  py-0.5
                                  text-[10px]
                                  font-bold
                                  uppercase
                                  text-red-300
                                "
                              >
                                {
                                  item.severity
                                }{" "}
                                risk
                              </span>
                            )}

                            <span
                              className="
                                rounded
                                bg-black/20
                                px-2
                                py-0.5
                                text-[10px]
                              "
                            >
                              {pct(
                                item.confidence ??
                                  0
                              )}{" "}
                              confidence
                            </span>
                          </div>

                          <h4
                            className="
                              mt-2
                              text-sm
                              font-semibold
                              text-white
                            "
                          >
                            {
                              item.title
                            }
                          </h4>
                        </div>

                        <button
                          onClick={() =>
                            toggleApproved(
                              item.id
                            )
                          }
                          className={`
                            shrink-0
                            rounded-lg
                            px-3
                            py-1.5
                            text-[11px]
                            font-semibold
                            transition

                            ${
                              item.approved ===
                              false
                                ? "border border-[#334155] text-[#94a3b8] hover:text-white"
                                : "bg-[#2563eb] text-white"
                            }
                          `}
                        >
                          {item.approved ===
                          false
                            ? "Ignored"
                            : "Keep"}
                        </button>
                      </div>

                      <p
                        className="
                          mt-3
                          text-sm
                          leading-6
                          text-[#cbd5e1]
                        "
                      >
                        {
                          item.content
                        }
                      </p>

                      {item.reason && (
                        <div
                          className="
                            mt-3
                            text-xs
                            leading-5
                          "
                        >
                          <span
                            className="
                              font-semibold
                              text-white
                            "
                          >
                            Why:{" "}
                          </span>

                          {
                            item.reason
                          }
                        </div>
                      )}

                      {item.evidence && (
                        <div
                          className="
                            mt-3
                            rounded-lg
                            border
                            border-white/5
                            bg-black/15
                            p-3
                            text-xs
                            leading-5
                            text-[#94a3b8]
                          "
                        >
                          <span
                            className="
                              font-semibold
                              text-white
                            "
                          >
                            Evidence
                            from
                            chat:{" "}
                          </span>

                          {
                            item.evidence
                          }
                        </div>
                      )}

                      {item.type ===
                        "assumption" && (
                        <div
                          className="
                            mt-3
                            grid
                            gap-2
                            md:grid-cols-2
                          "
                        >
                          <div
                            className="
                              rounded-lg
                              bg-amber-500/5
                              p-3
                              text-xs
                            "
                          >
                            <span
                              className="
                                font-semibold
                                text-amber-100
                              "
                            >
                              If
                              false:{" "}
                            </span>

                            {item.what_breaks_if_false ||
                              "Not specified"}
                          </div>

                          <div
                            className="
                              rounded-lg
                              bg-emerald-500/5
                              p-3
                              text-xs
                            "
                          >
                            <span
                              className="
                                font-semibold
                                text-emerald-100
                              "
                            >
                              Validate
                              by:{" "}
                            </span>

                            {item.validation_step ||
                              "No validation step proposed"}
                          </div>
                        </div>
                      )}

                      {item.type ===
                        "risk_flag" && (
                        <div
                          className="
                            mt-3
                            grid
                            gap-2
                            md:grid-cols-2
                          "
                        >
                          <div
                            className="
                              rounded-lg
                              bg-red-500/5
                              p-3
                              text-xs
                            "
                          >
                            <span
                              className="
                                font-semibold
                                text-red-200
                              "
                            >
                              Likelihood:{" "}
                            </span>

                            {item.likelihood ||
                              "unknown"}
                          </div>

                          <div
                            className="
                              rounded-lg
                              bg-red-500/5
                              p-3
                              text-xs
                            "
                          >
                            <span
                              className="
                                font-semibold
                                text-red-200
                              "
                            >
                              Impact:{" "}
                            </span>

                            {item.impact ||
                              "Not specified"}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* =============================================
                  ERROR
              ============================================= */}

              {error && (
                <div
                  className="
                    rounded-xl
                    border
                    border-red-500/30
                    bg-red-500/10
                    p-3
                    text-xs
                    text-red-300
                  "
                >
                  {error}
                </div>
              )}

              {/* =============================================
                  FINAL ACTIONS
              ============================================= */}

              <div
                className="
                  sticky
                  bottom-0
                  -mx-6
                  flex
                  flex-col-reverse
                  justify-between
                  gap-3
                  border-t
                  border-[#222734]
                  bg-[#161a24]/95
                  px-6
                  py-4
                  backdrop-blur
                  sm:flex-row
                  sm:items-center
                "
              >
                <button
                  onClick={() => {
                    setAnalysis(
                      null
                    );

                    setError(
                      null
                    );
                  }}
                  disabled={
                    approving
                  }
                  className="
                    rounded-xl
                    border
                    border-[#2a3040]
                    px-4
                    py-2.5
                    text-xs
                    text-[#94a3b8]
                    transition
                    hover:bg-[#222734]
                    hover:text-white
                    disabled:opacity-50
                  "
                >
                  Back
                </button>

                <button
                  onClick={() =>
                    void approve()
                  }
                  disabled={
                    approving ||
                    approvedCount ===
                      0
                  }
                  className="
                    flex
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#22c55e]
                    px-5
                    py-2.5
                    text-xs
                    font-semibold
                    text-black
                    transition
                    hover:bg-[#16a34a]
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                  "
                >
                  {approving ? (
                    <Loader2
                      className="
                        h-4
                        w-4
                        animate-spin
                      "
                    />
                  ) : (
                    <CheckCircle2
                      className="
                        h-4
                        w-4
                      "
                    />
                  )}

                  {approving
                    ? "Importing..."
                    : `Merge ${approvedCount} ${
                        approvedCount ===
                        1
                          ? "item"
                          : "items"
                      } into shared memory`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}