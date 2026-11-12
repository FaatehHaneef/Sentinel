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

  const ledgerColumns = useMemo<ColDef<LedgerRow>[]>(
    () => [
      { field: "trial", headerName: "Trial", width: 150, sort: "desc" },
      { field: "shopper", headerName: "Shopper", width: 150 },
      { field: "page", headerName: "Page", width: 140 },
      {
        field: "severity",
        headerName: "Severity",
        width: 120,
        comparator: (a: Severity, b: Severity) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b],
        valueFormatter: (params) =>
          params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : "",
        cellStyle: (params) => ({
          color: SEVERITY_COLOUR[params.value as Severity],
          fontWeight: 700,
        }),
      },
      { field: "check", headerName: "Check", flex: 1, minWidth: 220 },
      { field: "element", headerName: "Element", flex: 1, minWidth: 200 },
      {
        field: "measured",
        headerName: "Measured",
        flex: 2,
        minWidth: 300,
        tooltipField: "measured",
      },
      {
        field: "neededToBuy",
        headerName: "Needed to buy",
        width: 140,
        valueFormatter: (params) => (params.value ? "Yes" : "No"),
      },
      { field: "coins", headerName: "Coins", width: 100, type: "numericColumn" },
      {
        field: "status",
        headerName: "Status",
        width: 190,
        cellStyle: (params) => ({
          color: params.value === "Fixed in the next trial" ? "#6fae75" : "#f3e9d2",
        }),
      },
    ],
    [],
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

  return (
    <div className="space-y-10">
      <section aria-labelledby="ledger-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="ledger-heading" className="font-display text-2xl font-bold text-parchment">
              Every snag
            </h2>
            <p className="mt-1 text-mist">
              {ledger.length} snags across {records.length} trials, {open} not yet fixed. Sort or
              filter any column.
            </p>
          </div>
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

      <section aria-labelledby="history-heading">
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
