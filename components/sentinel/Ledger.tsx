"use client";

import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type RowClickedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { buildHistory, buildLedger, type HistoryRow, type LedgerRow } from "@/lib/trial/ledger";
import { PLAIN_SEVERITY } from "@/lib/trial/plain";
import { readAllRecords } from "@/lib/trial/progress";
import type { RunRecord, Severity } from "@/lib/trial/types";

ModuleRegistry.registerModules([AllCommunityModule]);

/** AG Grid's Quartz theme in Sentinel's dusk palette. */
const duskTheme = themeQuartz.withParams({
  browserColorScheme: "dark",
  backgroundColor: "#1b1f3b",
  foregroundColor: "#f3e9d2",
  chromeBackgroundColor: "#12152a",
  headerTextColor: "#ffb347",
  borderColor: "#2e3a5c",
  accentColor: "#ffb347",
  oddRowBackgroundColor: "#1f2445",
  fontFamily: "inherit",
  fontSize: 15,
  headerFontWeight: 700,
});

const noSubscription = () => () => {};

function useRecords(): RunRecord[] | null {
  const raw = useSyncExternalStore(
    noSubscription,
    () => JSON.stringify(readAllRecords(window.localStorage)),
    () => null,
  );
  return raw === null ? null : (JSON.parse(raw) as RunRecord[]);
}

const SEVERITY_ORDER: Record<Severity, number> = { blocker: 3, major: 2, minor: 1 };
const SEVERITY_COLOUR: Record<Severity, string> = {
  blocker: "#e05a6d",
  major: "#e8743b",
  minor: "#8fa3bf",
};

export function Ledger() {
  const records = useRecords();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [technical, setTechnical] = useState(false);

  const ledgerColumns = useMemo<ColDef<LedgerRow>[]>(
    () => [
      { field: "trial", headerName: "Trial", width: 150, sort: "desc" },
      { field: "shopper", headerName: "Shopper", width: 150 },
      { field: "page", headerName: "Where", width: 140 },
      { field: "problem", headerName: "Problem", flex: 2, minWidth: 260 },
      { field: "element", headerName: "On", flex: 1, minWidth: 180 },
      {
        field: "severity",
        headerName: "How bad",
        width: 200,
        comparator: (a: Severity, b: Severity) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b],
        valueFormatter: (params) => (params.value ? PLAIN_SEVERITY[params.value as Severity] : ""),
        cellStyle: (params) => ({
          color: SEVERITY_COLOUR[params.value as Severity],
          fontWeight: 700,
        }),
      },
      {
        field: "status",
        headerName: "Fixed yet?",
        width: 170,
        valueFormatter: (params) =>
          params.value === "Fixed in the next trial"
            ? "Fixed"
            : params.value === "Still open"
              ? "Not yet"
              : "Not tried yet",
        cellStyle: (params) => ({
          color: params.value === "Fixed in the next trial" ? "#6fae75" : "#f3e9d2",
        }),
      },
      // Technical detail, hidden until asked for.
      { field: "check", headerName: "Check", flex: 1, minWidth: 220, hide: !technical },
      {
        field: "measured",
        headerName: "Measured",
        flex: 2,
        minWidth: 300,
        tooltipField: "measured",
        hide: !technical,
      },
      {
        field: "neededToBuy",
        headerName: "Needed to buy",
        width: 140,
        valueFormatter: (params) => (params.value ? "Yes" : "No"),
        hide: !technical,
      },
      { field: "coins", headerName: "Coins", width: 100, type: "numericColumn", hide: !technical },
    ],
    [technical],
  );

  const historyColumns = useMemo<ColDef<HistoryRow>[]>(
    () => [
      { field: "started", headerName: "Started", width: 160 },
      { field: "shoppers", headerName: "Shoppers", flex: 2, minWidth: 220 },
      {
        headerName: "Bought",
        width: 110,
        valueGetter: (params) =>
          params.data ? `${params.data.purchases} of ${params.data.shopperCount}` : "",
      },
      { field: "snags", headerName: "Snags", width: 100, type: "numericColumn" },
      { field: "fixed", headerName: "Fixed", width: 100, type: "numericColumn" },
      { field: "coinsLost", headerName: "Coins lost", width: 120, type: "numericColumn" },
      { field: "xp", headerName: "XP", width: 100, type: "numericColumn" },
      {
        field: "rerunOf",
        headerName: "Re-run of",
        width: 170,
        valueFormatter: (params) => params.value ?? "",
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({ sortable: true, filter: true, resizable: true }),
    [],
  );

  if (records === null) return <p className="text-lg text-mist">Opening the ledger…</p>;

  if (records.length === 0) {
    return (
      <p className="text-lg text-mist">
        No trials yet in this browser.{" "}
        <Link href="/lobby" className="font-bold text-amber underline underline-offset-4">
          Send some shoppers
        </Link>{" "}
        and their findings will appear here.
      </p>
    );
  }

  const ledger = buildLedger(records);
  const history = buildHistory(records);
  const open = ledger.filter((row) => row.status !== "Fixed in the next trial").length;
  const fixed = ledger.length - open;
  const byShopper = new Map<string, number>();
  for (const row of ledger) {
    if (row.status !== "Fixed in the next trial") {
      byShopper.set(row.shopper, (byShopper.get(row.shopper) ?? 0) + 1);
    }
  }
  const struggled = [...byShopper.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="pixel-panel">
          <p className="font-display text-sm uppercase tracking-widest text-rose">Still to fix</p>
          <p className="mt-1 text-4xl font-bold text-parchment">{open}</p>
        </div>
        <div className="pixel-panel">
          <p className="font-display text-sm uppercase tracking-widest text-moss">Fixed</p>
          <p className="mt-1 text-4xl font-bold text-parchment">{fixed}</p>
        </div>
        <div className="pixel-panel">
          <p className="font-display text-sm uppercase tracking-widest text-amber">
            Struggled most
          </p>
          <p className="mt-1 text-2xl font-bold text-parchment">
            {struggled ? `${struggled[0]}, ${struggled[1]} left` : "Nobody"}
          </p>
        </div>
      </div>

      <section aria-labelledby="ledger-heading" className="pixel-panel">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="ledger-heading" className="font-display text-2xl font-bold text-parchment">
              Every snag
            </h2>
            <p className="mt-1 text-mist">
              Every problem your shoppers met, across {records.length} trials. Sort or filter any
              column.
            </p>
          </div>
          <label className="flex items-center gap-2 text-parchment">
            <input
              type="checkbox"
              className="round-check"
              checked={technical}
              onChange={(event) => setTechnical(event.target.checked)}
            />
            Show technical detail
          </label>
          <label className="text-parchment">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Shopper, page, element…"
              className="ml-3 rounded border-2 border-slate bg-night px-3 py-2 text-parchment placeholder:text-mist"
            />
          </label>
        </div>
        <div className="mt-4 h-[32rem] w-full">
          <AgGridReact<LedgerRow>
            theme={duskTheme}
            rowData={ledger}
            columnDefs={ledgerColumns}
            defaultColDef={defaultColDef}
            quickFilterText={search}
            pagination
            paginationPageSize={20}
            paginationPageSizeSelector={[20, 50, 100]}
            enableCellTextSelection
            // Every column is drawn, so screen readers and in-page search reach every cell.
            suppressColumnVirtualisation
            tooltipShowDelay={300}
          />
        </div>
      </section>

      <section aria-labelledby="history-heading" className="pixel-panel">
        <h2 id="history-heading" className="font-display text-2xl font-bold text-parchment">
          Trials
        </h2>
        <p className="mt-1 text-mist">Newest first. Choose a trial to open its results.</p>
        <div className="mt-4 h-80 w-full">
          <AgGridReact<HistoryRow>
            theme={duskTheme}
            rowData={history}
            columnDefs={historyColumns}
            defaultColDef={defaultColDef}
            rowStyle={{ cursor: "pointer" }}
            onRowClicked={(event: RowClickedEvent<HistoryRow>) => {
              if (event.data) router.push(`/runs/${event.data.runId}`);
            }}
          />
        </div>
        <ul className="sr-only">
          {history.map((row) => (
            <li key={row.runId}>
              <Link href={`/runs/${row.runId}`}>Results of the trial started {row.started}</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
