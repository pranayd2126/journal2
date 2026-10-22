import { journalRows, pageRows } from "../../lib/journalWorkflow";
import { calculatedPnl, sum } from "../../lib/tradingAnalytics";
import {
  useState,
  useMemo,
  useEffect,
  FormEvent,
  useRef,
  ChangeEvent,
} from "react";
import { Trade, EmotionalState, UserSettings } from "../../types";
import { dbService } from "../../services/dbService";
import {
  Plus,
  X,
  Check,
  Target,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useRiskManager } from "../../hooks/useRiskManager";

interface TradeJournalProps {
  openRequested?: boolean;
  onOpenHandled?: () => void;
  onReview?: (trade: Trade) => void;
  trades: Trade[];
  onTradeAdded: (trade: Trade) => void;
  onTradeUpdated: (trade: Trade) => void;
  onTradeDeleted: (tradeId: string) => void;
  settings: UserSettings;
}

const MISTAKES_OPTIONS = [
  "FOMO",
  "Revenge trading",
  "Over-risk",
  "No confirmation",
  "Early entry",
  "Late exit",
  "Early exit",
  "Ignoring Stop Loss",
  "Emotional entry",
  "No Plan",
  "Overtrading",
  "News trading",
];

const EMOTIONS_OPTIONS: EmotionalState[] = [
  "CALM",
  "CONFIDENT",
  "EXCITED",
  "ANXIOUS",
  "FEAR",
  "ANGRY",
  "REVENGE",
  "TIRED",
  "FOMO",
];

export default function TradeJournal({
  trades,
  onTradeAdded,
  onTradeUpdated,
  onTradeDeleted,
  settings,
  openRequested,
  onOpenHandled,
  onReview,
}: TradeJournalProps) {
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [strategy, setStrategy] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const submissionId = useRef(crypto.randomUUID());
  const [error, setError] = useState("");
  const [originalTrade, setOriginalTrade] = useState<Trade | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [sortBy, setSortBy] = useState<"date" | "pnl" | "symbol">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const risk = useRiskManager(trades, settings);

  const initialFormData = {
    entryTime: new Date().toISOString().slice(0, 16),
    exitTime: new Date().toISOString().slice(0, 16),
    symbol: "",
    side: "LONG" as "LONG" | "SHORT",
    entryPrice: "",
    exitPrice: "",
    stopLoss: "",
    targetPrice: "",
    quantity: "",
    charges: "0",
    multiplier: "1",
    brokerage: "0",
    riskPercentage: "1",
    setupType: "",
    tradeReason: "",
    imageUrl: "",
    tags: [] as string[],
    marketCondition: "TRENDING_UP" as any,
    confirmations: [] as string[],
    entryQuality: "PERFECT" as any,
    exitQuality: "PERFECT" as any,
    followedPlan: true,
    followedSL: true,
    respectedRR: true,
    psyBefore: "CALM" as EmotionalState,
    psyDuring: "CALM" as EmotionalState,
    psyAfter: "CALM" as EmotionalState,
    boredomTrade: false,
    revengeTrade: false,
    pressureToWin: false,
    overallTrend: "NEUTRAL" as any,
    volatility: "LOW" as any,
    newsEvent: false,
    mistakes: [] as string[],
  };

  const [formData, setFormData] = useState(initialFormData);
  const [recordContext, setRecordContext] = useState<Record<number, boolean>>(
    {},
  );
  const [tagText, setTagText] = useState("");
  useEffect(() => {
    if (openRequested) {
      setOriginalTrade(null);
      setEditingTradeId(null);
      setActiveStep(0);
      setFormData(initialFormData);
      setRecordContext({});
      setTagText("");
      setIsAdding(true);
      onOpenHandled?.();
    }
  }, [openRequested]);
  useEffect(() => setPage(1), [search, outcome, strategy, reviewFilter]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result;

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64data }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "Upload failed server-side:",
            response.status,
            errorText,
          );
          throw new Error(`Upload failed: ${response.status}`);
        }

        const data = await response.json();
        if (data.url) {
          setFormData((prev) => ({ ...prev, imageUrl: data.url }));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not upload screenshot",
        );
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      console.error("Failed to read file");
      setIsUploading(false);
    };
  };

  const livePnl = useMemo(() => {
    const entry = parseFloat(formData.entryPrice);
    const exit = parseFloat(formData.exitPrice);
    const qty = parseFloat(formData.quantity);
    const brokerage = parseFloat(formData.brokerage) || 0;
    if (isNaN(entry) || isNaN(exit) || isNaN(qty)) return null;

    return calculatedPnl({
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      brokerage,
      charges: Number(formData.charges),
      multiplier: Number(formData.multiplier),
      side: formData.side,
    });
  }, [formData]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
      return;
    }

    const user = dbService.getCurrentUser();
    if (!user || risk.isLocked || savingRef.current) return;
    if (
      !formData.entryTime ||
      !formData.exitTime ||
      !Number.isFinite(Date.parse(formData.entryTime + ":00Z")) ||
      !Number.isFinite(Date.parse(formData.exitTime + ":00Z"))
    ) {
      setError("Valid entry and exit dates are required");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError("");

    const tradeData: any = {
      ...originalTrade,
      entryTime:
        originalTrade?.entryTime?.slice(0, 16) === formData.entryTime
          ? originalTrade.entryTime
          : new Date(formData.entryTime + ":00Z").toISOString(),
      exitTime:
        originalTrade?.exitTime?.slice(0, 16) === formData.exitTime
          ? originalTrade.exitTime
          : new Date(formData.exitTime + ":00Z").toISOString(),
      userId: user.id,
      symbol: formData.symbol.toUpperCase(),
      side: formData.side,
      entryPrice: parseFloat(formData.entryPrice),
      exitPrice: parseFloat(formData.exitPrice),
      stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : null,
      targetPrice: formData.targetPrice
        ? parseFloat(formData.targetPrice)
        : null,
      quantity: parseFloat(formData.quantity),
      charges: Number(formData.charges),
      multiplier: Number(formData.multiplier),
      brokerage: parseFloat(formData.brokerage) || 0,
      pnl: livePnl || 0,
      riskPercentage: parseFloat(formData.riskPercentage),
      setupType: formData.setupType,
      tradeReason: formData.tradeReason,
      imageUrl: formData.imageUrl,
      tags: tagText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      marketCondition: formData.marketCondition,
      confirmations: formData.confirmations,
      executionQuality: {
        entry: formData.entryQuality,
        exit: formData.exitQuality,
        followedSL: formData.followedSL,
        followedPlan: formData.followedPlan,
        respectedRR: formData.respectedRR,
      },
      psychology: {
        before: formData.psyBefore,
        during: formData.psyDuring,
        after: formData.psyAfter,
        boredomTrade: formData.boredomTrade,
        revengeTrade: formData.revengeTrade,
        pressureToWin: formData.pressureToWin,
      },
      marketContext: {
        overallTrend: formData.overallTrend,
        volatility: formData.volatility,
        newsEvent: formData.newsEvent,
      },
      mistakes: formData.mistakes,
    };

    // Untouched optional assessments are not evidence of calm or perfect execution.
    for (const [key, step] of [
      ["executionQuality", 1],
      ["psychology", 2],
      ["marketCondition", 3],
      ["marketContext", 3],
    ] as const) {
      if (!recordContext[step]) {
        if (originalTrade?.[key] !== undefined)
          tradeData[key] = originalTrade[key];
        else delete tradeData[key];
      }
    }
    try {
      if (editingTradeId) {
        const saved = await dbService.updateDocument(
          `users/${user.id}/trades`,
          editingTradeId,
          { ...tradeData, version: originalTrade?.version ?? 0 },
        );
        onTradeUpdated(saved);
      } else {
        tradeData.createdAt = null; // serverTimestamp handled by dbService
        const id = await dbService.addDocument(
          `users/${user.id}/trades`,
          tradeData,
          submissionId.current,
        );
        onTradeAdded({ ...tradeData, id });
      }
      submissionId.current = crypto.randomUUID();
      setOriginalTrade(null);
      setIsAdding(false);
      setEditingTradeId(null);
      setActiveStep(0);
      setFormData(initialFormData);
      setRecordContext({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save trade");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleEdit = (trade: Trade) => {
    setTagText((trade.tags ?? []).join(", "));
    setOriginalTrade(trade);
    setRecordContext({});
    setEditingTradeId(trade.id || null);
    setFormData({
      entryTime: trade.entryTime?.slice(0, 16) || initialFormData.entryTime,
      exitTime: trade.exitTime?.slice(0, 16) || initialFormData.exitTime,
      symbol: trade.symbol || "",
      side: trade.side || "LONG",
      entryPrice: trade.entryPrice?.toString() || "",
      exitPrice: trade.exitPrice?.toString() || "",
      stopLoss: trade.stopLoss?.toString() || "",
      targetPrice: trade.targetPrice?.toString() || "",
      quantity: trade.quantity?.toString() || "",
      charges: trade.charges?.toString() || "0",
      multiplier: trade.multiplier?.toString() || "1",
      brokerage: trade.brokerage?.toString() || "0",
      riskPercentage: trade.riskPercentage?.toString() || "1",
      setupType: trade.setupType,
      tradeReason: trade.tradeReason || "",
      imageUrl: trade.imageUrl || "",
      tags: trade.tags || [],
      marketCondition: trade.marketCondition || "TRENDING_UP",
      confirmations: trade.confirmations || [],
      entryQuality: trade.executionQuality?.entry || "PERFECT",
      exitQuality: trade.executionQuality?.exit || "PERFECT",
      followedPlan: trade.executionQuality?.followedPlan ?? true,
      followedSL: trade.executionQuality?.followedSL ?? true,
      respectedRR: trade.executionQuality?.respectedRR ?? true,
      psyBefore: trade.psychology?.before || "CALM",
      psyDuring: trade.psychology?.during || "CALM",
      psyAfter: trade.psychology?.after || "CALM",
      boredomTrade: trade.psychology?.boredomTrade ?? false,
      revengeTrade: trade.psychology?.revengeTrade ?? false,
      pressureToWin: trade.psychology?.pressureToWin ?? false,
      overallTrend: trade.marketContext?.overallTrend || "NEUTRAL",
      volatility: trade.marketContext?.volatility || "LOW",
      newsEvent: trade.marketContext?.newsEvent ?? false,
      mistakes: trade.mistakes || [],
    });
    setIsAdding(true);
    setActiveStep(0);
  };

  const handleDelete = async (tradeId: string) => {
    console.log("Attempting to delete trade:", tradeId);
    const user = dbService.getCurrentUser();
    if (!user) {
      console.error("No user found in dbService");
      return;
    }
    try {
      await dbService.deleteDocument(`users/${user.id}/trades`, tradeId);
      console.log("Trade deleted successfully from DB");
      onTradeDeleted(tradeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete trade");
    }
  };

  const sortedTrades = useMemo(() => {
    return journalRows(trades, {
      search,
      outcome,
      strategy,
      review: reviewFilter,
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === "date") {
        const dateA = new Date(a.entryTime).getTime();
        const dateB = new Date(b.entryTime).getTime();
        const timeA = isNaN(dateA) ? 0 : dateA;
        const timeB = isNaN(dateB) ? 0 : dateB;
        comparison = timeA - timeB;
      } else if (sortBy === "pnl") {
        comparison = a.pnl - b.pnl;
      } else if (sortBy === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [trades, sortBy, sortOrder, search, outcome, strategy, reviewFilter]);
  const paged = pageRows(sortedTrades, page, settings.compactRows ? 40 : 20);

  const toggleSort = (field: "date" | "pnl" | "symbol") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const steps = [
    { title: "Basics & Data", icon: Target },
    { title: "Execution Quality", icon: Check },
    { title: "Psychology & Mistakes", icon: AlertTriangle },
    { title: "Market Context", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      {isAdding ? (
        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 relative shadow-2xl">
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setOriginalTrade(null);
              setEditingTradeId(null);
              setFormData(initialFormData);
              setRecordContext({});
            }}
            className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white z-20"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex flex-col md:flex-row md:items-center gap-6 mb-12">
            <h2 className="text-xl font-bold text-white uppercase tracking-widest shrink-0">
              {editingTradeId ? "Edit Trade" : "Journal New Trade"}
            </h2>
            <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 shrink-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      activeStep === i
                        ? "bg-blue-600 text-white"
                        : activeStep > i
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {activeStep > i ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest hidden lg:block ${activeStep === i ? "text-white" : "text-zinc-600"}`}
                  >
                    {s.title}
                  </span>
                  {i < steps.length - 1 && (
                    <div className="w-4 h-px bg-zinc-800" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (e.target instanceof HTMLTextAreaElement) return; // Allow Enter in textareas

                e.preventDefault();
                if (activeStep < steps.length - 1) {
                  setActiveStep((s) => s + 1);
                }
              }
            }}
            className="space-y-8"
          >
            {activeStep === 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label>
                    Entry time (UTC)
                    <input
                      aria-label="Entry time (UTC)"
                      type="datetime-local"
                      required
                      value={formData.entryTime}
                      onChange={(e) =>
                        setFormData({ ...formData, entryTime: e.target.value })
                      }
                      className="w-full bg-zinc-900 p-3 rounded"
                    />
                  </label>
                  <label>
                    Exit time (UTC)
                    <input
                      aria-label="Exit time (UTC)"
                      type="datetime-local"
                      required
                      value={formData.exitTime}
                      onChange={(e) =>
                        setFormData({ ...formData, exitTime: e.target.value })
                      }
                      className="w-full bg-zinc-900 p-3 rounded"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Input
                    label="Symbol"
                    value={formData.symbol}
                    onChange={(v) => setFormData({ ...formData, symbol: v })}
                    placeholder="NIFTY, BTC"
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Side
                    </label>
                    <div className="flex bg-zinc-900 p-1 rounded-xl">
                      {["LONG", "SHORT"].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, side: s as any })
                          }
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            formData.side === s
                              ? s === "LONG"
                                ? "bg-emerald-500 text-white"
                                : "bg-red-500 text-white"
                              : "text-zinc-500"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    label="Quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(v) => setFormData({ ...formData, quantity: v })}
                  />
                  <Input
                    label="Brokerage (₹)"
                    type="number"
                    value={formData.brokerage}
                    onChange={(v) => setFormData({ ...formData, brokerage: v })}
                  />
                  <Input
                    label="Other Charges (₹)"
                    type="number"
                    value={formData.charges}
                    onChange={(v) => setFormData({ ...formData, charges: v })}
                  />
                  <Input
                    label="Contract Multiplier"
                    type="number"
                    value={formData.multiplier}
                    onChange={(v) =>
                      setFormData({ ...formData, multiplier: v })
                    }
                  />
                  <Input
                    label="Risk %"
                    type="number"
                    value={formData.riskPercentage}
                    onChange={(v) =>
                      setFormData({ ...formData, riskPercentage: v })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Input
                    label="Entry Price"
                    type="number"
                    value={formData.entryPrice}
                    onChange={(v) =>
                      setFormData({ ...formData, entryPrice: v })
                    }
                  />
                  <Input
                    label="Exit Price"
                    type="number"
                    value={formData.exitPrice}
                    onChange={(v) => setFormData({ ...formData, exitPrice: v })}
                  />
                  <Input
                    label="Stop Loss"
                    type="number"
                    value={formData.stopLoss}
                    onChange={(v) => setFormData({ ...formData, stopLoss: v })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    label="Setup Type"
                    value={formData.setupType}
                    onChange={(v) => setFormData({ ...formData, setupType: v })}
                    placeholder="Breakout, Pullback..."
                  />
                  <Input
                    label="Planned Target Price"
                    type="number"
                    value={formData.targetPrice}
                    onChange={(v) =>
                      setFormData({ ...formData, targetPrice: v })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Trade Tags (Comma separated)
                    </label>
                    <input
                      type="text"
                      placeholder="High Prob, Trend Line, Fakeout"
                      value={tagText}
                      onChange={(e) => setTagText(e.target.value)}
                      className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-blue-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      Trade Screenshot
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex-1 h-12 bg-zinc-900 border border-zinc-800 border-dashed rounded-xl flex items-center justify-center gap-2 text-zinc-500 hover:text-white hover:border-zinc-700 transition-all overflow-hidden relative"
                      >
                        {isUploading ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        ) : formData.imageUrl ? (
                          <img
                            src={formData.imageUrl}
                            alt="Trade Preview"
                            className="w-full h-full object-cover opacity-50"
                          />
                        ) : (
                          <>
                            <ImageIcon className="w-5 h-5" />
                            <span className="text-xs font-bold uppercase tracking-widest">
                              Upload Screenshot
                            </span>
                          </>
                        )}
                        {formData.imageUrl && !isUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white">
                              Change Screenshot
                            </span>
                          </div>
                        )}
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      {formData.imageUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, imageUrl: "" })
                          }
                          className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500 hover:text-red-500"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <textarea
                  placeholder="Why did you take this trade? (Reasoning)"
                  value={formData.tradeReason}
                  onChange={(e) =>
                    setFormData({ ...formData, tradeReason: e.target.value })
                  }
                  className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            {activeStep > 0 && (
              <label className="check-label flex items-center gap-3 text-sm mb-5">
                <input
                  type="checkbox"
                  checked={recordContext[activeStep] ?? false}
                  onChange={(e) =>
                    setRecordContext({
                      ...recordContext,
                      [activeStep]: e.target.checked,
                    })
                  }
                />
                Save this step’s optional assessment (otherwise keep previous
                assessment, if any)
              </label>
            )}
            {activeStep === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <QualitySelector
                    label="Entry Quality"
                    value={formData.entryQuality}
                    onChange={(v) =>
                      setFormData({ ...formData, entryQuality: v })
                    }
                    options={["EARLY", "PERFECT", "LATE"]}
                  />
                  <QualitySelector
                    label="Exit Quality"
                    value={formData.exitQuality}
                    onChange={(v) =>
                      setFormData({ ...formData, exitQuality: v })
                    }
                    options={["EARLY", "PERFECT", "LATE"]}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <Checkbox
                    label="Followed Stop Loss?"
                    checked={formData.followedSL}
                    onChange={(v) =>
                      setFormData({ ...formData, followedSL: v })
                    }
                  />
                  <Checkbox
                    label="Followed Trade Plan?"
                    checked={formData.followedPlan}
                    onChange={(v) =>
                      setFormData({ ...formData, followedPlan: v })
                    }
                  />
                  <Checkbox
                    label="Respected Risk-Reward?"
                    checked={formData.respectedRR}
                    onChange={(v) =>
                      setFormData({ ...formData, respectedRR: v })
                    }
                  />
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EmotionSelector
                    label="Before"
                    value={formData.psyBefore}
                    onChange={(v) => setFormData({ ...formData, psyBefore: v })}
                  />
                  <EmotionSelector
                    label="During"
                    value={formData.psyDuring}
                    onChange={(v) => setFormData({ ...formData, psyDuring: v })}
                  />
                  <EmotionSelector
                    label="After"
                    value={formData.psyAfter}
                    onChange={(v) => setFormData({ ...formData, psyAfter: v })}
                  />
                </div>
                <div className="flex flex-wrap gap-4 py-2 border-y border-zinc-900">
                  <Checkbox
                    label="Trade out of boredom?"
                    checked={formData.boredomTrade}
                    onChange={(v) =>
                      setFormData({ ...formData, boredomTrade: v })
                    }
                  />
                  <Checkbox
                    label="Revenge trade?"
                    checked={formData.revengeTrade}
                    onChange={(v) =>
                      setFormData({ ...formData, revengeTrade: v })
                    }
                  />
                  <Checkbox
                    label="Pressure to win?"
                    checked={formData.pressureToWin}
                    onChange={(v) =>
                      setFormData({ ...formData, pressureToWin: v })
                    }
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Mistake Tagging
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MISTAKES_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            mistakes: prev.mistakes.includes(m)
                              ? prev.mistakes.filter((x) => x !== m)
                              : [...prev.mistakes, m],
                          }))
                        }
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                          formData.mistakes.includes(m)
                            ? "bg-red-500/20 text-red-500 border-red-500/50"
                            : "bg-zinc-900 text-zinc-500 border-zinc-900 hover:border-zinc-800"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <GranularSelector
                    label="Overall Market Trend"
                    value={formData.overallTrend}
                    onChange={(v) =>
                      setFormData({ ...formData, overallTrend: v })
                    }
                    options={[
                      { id: "BULLISH", label: "Bullish" },
                      { id: "BEARISH", label: "Bearish" },
                      { id: "NEUTRAL", label: "Neutral" },
                    ]}
                  />
                  <GranularSelector
                    label="Market Condition"
                    value={formData.marketCondition}
                    onChange={(v) =>
                      setFormData({ ...formData, marketCondition: v })
                    }
                    options={[
                      { id: "TRENDING_UP", label: "Trending Up" },
                      { id: "TRENDING_DOWN", label: "Trending Down" },
                      { id: "SIDEWAYS", label: "Sideways Range" },
                      { id: "CHOPPY", label: "Choppy" },
                    ]}
                  />
                </div>

                {livePnl !== null ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-black border border-zinc-800 rounded-3xl relative overflow-hidden group">
                    <div
                      className={`absolute inset-0 opacity-5 bg-linear-to-b ${livePnl >= 0 ? "from-emerald-500 to-transparent" : "from-red-500 to-transparent"}`}
                    />
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 relative z-10">
                      Calculated Trade Outcome (After All Charges)
                    </p>
                    <h4
                      className={`text-5xl font-mono font-bold relative z-10 ${livePnl >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {livePnl >= 0 ? "+" : ""}₹{livePnl.toLocaleString()}
                    </h4>
                    <div className="flex gap-6 mt-6 relative z-10">
                      <div className="text-center">
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                          Gross P&L
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          ₹
                          {sum([
                            livePnl ?? 0,
                            Number(formData.brokerage) || 0,
                            Number(formData.charges) || 0,
                          ]).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                          Brokerage
                        </p>
                        <p className="text-xs text-zinc-400 font-mono">
                          ₹{parseFloat(formData.brokerage) || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-zinc-900/50 border border-zinc-800 rounded-3xl text-center">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-zinc-400">
                      Missing price/quantity data from Step 1 to calculate final
                      outcome.
                    </p>
                  </div>
                )}

                <div className="p-4 bg-zinc-900 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white uppercase">
                      Volatility & News
                    </p>
                    <p className="text-[10px] text-zinc-500 tracking-wide uppercase font-bold">
                      Additional Context
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Checkbox
                      label="News Event"
                      checked={formData.newsEvent}
                      onChange={(v) =>
                        setFormData({ ...formData, newsEvent: v })
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-8 border-t border-zinc-900">
              <button
                type="button"
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                disabled={activeStep === 0}
                className="px-6 py-2 text-zinc-500 font-bold hover:text-white disabled:opacity-0 transition-all"
              >
                Previous
              </button>

              {activeStep < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((s) => s + 1)}
                  className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all"
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={
                    saving ||
                    isUploading ||
                    (risk.isLocked && !editingTradeId) ||
                    !formData.symbol
                  }
                  title={
                    risk.isLocked && !editingTradeId
                      ? "Trading session locked due to risk rules breach"
                      : !formData.symbol
                        ? "Ticker symbol is required"
                        : ""
                  }
                  className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-xl shadow-blue-600/20 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {editingTradeId
                    ? "Update Trade"
                    : "Complete Pro Journal Entry"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">Recent Trades</h3>
              <p className="text-xs text-zinc-500 font-mono mt-1">
                TOTAL_RECORDS: {trades.length}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <SortButton
                  active={sortBy === "date"}
                  order={sortOrder}
                  onClick={() => toggleSort("date")}
                >
                  Date
                </SortButton>
                <SortButton
                  active={sortBy === "symbol"}
                  order={sortOrder}
                  onClick={() => toggleSort("symbol")}
                >
                  Symbol
                </SortButton>
                <SortButton
                  active={sortBy === "pnl"}
                  order={sortOrder}
                  onClick={() => toggleSort("pnl")}
                >
                  P&L
                </SortButton>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTagText("");
                  setOriginalTrade(null);
                  submissionId.current = crypto.randomUUID();
                  setActiveStep(0);
                  setEditingTradeId(null);
                  setFormData(initialFormData);
                  setRecordContext({});
                  setIsAdding(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all"
              >
                Manual Log
              </button>
            </div>
          </div>

          <div className="filter-bar">
            <input
              aria-label="Search journal"
              placeholder="Search symbol, notes or tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Journal outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">All outcomes</option>
              <option value="win">Winners</option>
              <option value="loss">Losers</option>
              <option value="flat">Breakeven</option>
            </select>
            <select
              aria-label="Journal setup"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              <option value="">All setups</option>
              {[...new Set(trades.map((t) => t.setupType))]
                .filter(Boolean)
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
            <select
              aria-label="Journal review status"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              <option value="">All review statuses</option>
              <option value="PENDING">Pending</option>
              <option value="REVIEWED">Reviewed</option>
            </select>
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setOutcome("");
                setStrategy("");
                setReviewFilter("");
              }}
            >
              Clear filters
            </button>
          </div>
          <p className="caption">
            {paged.total} matching trades · financial summaries always use the
            complete history
          </p>
          {!paged.total && (
            <div className="empty-state">
              <h3>No matching trades</h3>
              <p>Clear filters or use Manual Log to record your first trade.</p>
            </div>
          )}
          <div className="pagination">
            <button
              className="btn-secondary"
              disabled={paged.current === 1}
              onClick={() => setPage(paged.current - 1)}
            >
              Previous page
            </button>
            <span>
              Page {paged.current} of {paged.pages}
            </span>
            <button
              className="btn-secondary"
              disabled={paged.current === paged.pages}
              onClick={() => setPage(paged.current + 1)}
            >
              Next page
            </button>
          </div>
          <div className="space-y-3">
            {paged.rows.map((trade) => (
              <div
                key={trade.id}
                className={`${settings.compactRows ? "p-2" : "p-4"} bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-wrap md:flex-nowrap items-center justify-between gap-4 group hover:border-zinc-700 transition-all`}
              >
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div
                    className={`p-3 rounded-xl ${trade.pnl >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                  >
                    {trade.pnl >= 0 ? (
                      <TrendingUp className="w-5 h-5" />
                    ) : (
                      <TrendingDown className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white">{trade.symbol}</h4>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trade.side === "LONG" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                      >
                        {trade.side}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {trade.quantity} units •{" "}
                      {(() => {
                        try {
                          const d = new Date(trade.entryTime);
                          return !isNaN(d.getTime())
                            ? format(d, "MMM d, HH:mm")
                            : "Invalid date";
                        } catch (e) {
                          return "Invalid date";
                        }
                      })()}
                    </p>
                  </div>
                </div>

                <div className="flex-1 hidden md:flex items-center gap-2 px-4">
                  {trade.mistakes.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="px-2 py-1 bg-zinc-900 text-zinc-500 text-[10px] font-bold rounded uppercase tracking-wider"
                    >
                      {m}
                    </span>
                  ))}
                  {trade.mistakes.length > 2 && (
                    <span className="text-[10px] text-zinc-500">
                      +{trade.mistakes.length - 2}
                    </span>
                  )}
                  {trade.setupType && (
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded uppercase tracking-wider">
                      {trade.setupType}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p
                      className={`font-mono font-bold text-lg ${trade.pnl >= 0 ? "text-emerald-500" : "text-red-500"}`}
                    >
                      {trade.pnl >= 0 ? "+" : ""}₹{trade.pnl.toLocaleString()}
                    </p>
                    <div className="flex flex-col items-end">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                        {trade.executionQuality?.followedPlan === undefined
                          ? "Not assessed"
                          : trade.executionQuality.followedPlan
                            ? "Followed plan"
                            : "Rule Breach"}
                      </p>
                      {trade.brokerage > 0 && (
                        <p className="text-[9px] text-zinc-600 font-medium">
                          Brokerage: ₹{trade.brokerage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={`Review ${trade.symbol}`}
                      onClick={() => onReview?.(trade)}
                    >
                      {trade.review?.status === "REVIEWED"
                        ? "Reviewed"
                        : "Review"}
                    </button>
                    <button
                      type="button"
                      aria-label="Edit trade"
                      onClick={() => handleEdit(trade)}
                      className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition-all"
                      title="Edit Trade"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete trade"
                      onClick={() => trade.id && handleDelete(trade.id)}
                      className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      title="Delete Trade"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {trades.length === 0 && (
              <div className="py-20 text-center bg-zinc-950 border border-dashed border-zinc-900 rounded-2xl">
                <p className="text-zinc-500 text-sm">
                  No trades logged yet. Start journaling your performance.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
}: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
        {label}
      </label>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-white focus:outline-none focus:border-blue-500/50 focus:bg-zinc-800 transition-all font-mono"
      />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: any) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
          checked
            ? "bg-blue-600 border-blue-600"
            : "bg-zinc-950 border-zinc-800 group-hover:border-zinc-700"
        }`}
      >
        {checked && <Check className="w-4 h-4 text-white" />}
      </div>
      <span
        className={`text-sm font-medium ${checked ? "text-white" : "text-zinc-500"}`}
      >
        {label}
      </span>
    </button>
  );
}

function GranularSelector({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {label}
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {options.map((opt: { id: string; label: string } | string) => {
          const id = typeof opt === "string" ? opt : opt.id;
          const labelText = typeof opt === "string" ? opt : opt.label;
          const isActive = value === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`py-2.5 px-2 text-[10px] font-bold rounded-xl border transition-all ${
                isActive
                  ? "bg-white text-black border-white"
                  : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
              }`}
            >
              {labelText}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QualitySelector({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {label}
      </label>
      <div className="flex bg-zinc-900 p-1 rounded-xl gap-1">
        {options.map((opt: string) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${
              value === opt
                ? "bg-blue-600 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmotionSelector({ label, value, onChange }: any) {
  const emotions = [
    "CALM",
    "CONFIDENT",
    "FOMO",
    "FEAR",
    "REVENGE",
    "ANXIOUS",
  ] as const;
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
        {label} Trade
      </label>
      <div className="grid grid-cols-2 gap-2">
        {emotions.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className={`py-2 px-3 text-[10px] font-bold rounded-xl border transition-all ${
              value === e
                ? "bg-white text-black border-white"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function SortButton({ children, active, order, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${
        active ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"
      }`}
    >
      {children}
      {active &&
        (order === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        ))}
    </button>
  );
}
