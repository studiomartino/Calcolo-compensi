import { useMemo } from "react";
import { Users, TrendingUp, AlertTriangle, Calculator, Download, FileSpreadsheet, CreditCard, Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CompensoRecord, OperatorReport } from "@shared/schema";

interface OperatorDashboardProps {
  records: CompensoRecord[];
  onExportExcel: () => void;
  selectedOperator: string | null;
  onSelectOperator: (operator: string | null) => void;
}

export function OperatorDashboard({
  records,
  onExportExcel,
  selectedOperator,
  onSelectOperator,
}: OperatorDashboardProps) {
  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const operatorReports = useMemo((): OperatorReport[] => {
    const operatorMap = new Map<string, CompensoRecord[]>();
    
    records.forEach((record) => {
      const existing = operatorMap.get(record.operatore) || [];
      existing.push(record);
      operatorMap.set(record.operatore, existing);
    });

    return Array.from(operatorMap.entries()).map(([operatore, operatorRecords]) => {
      const compensoTotale = operatorRecords.reduce(
        (sum, r) => sum + r.compensoOperatore,
        0
      );
      const compensoCard = operatorRecords
        .filter((r) => r.categoriaCompenso === "card")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCash = operatorRecords
        .filter((r) => r.categoriaCompenso === "cash")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const numeroAnomalie = operatorRecords.filter((r) => r.hasAnomaly).length;

      return {
        operatore,
        compensoTotale,
        compensoCard,
        compensoCash,
        compensoTotaleArrotondato: roundToTen(compensoTotale),
        compensoCardArrotondato: roundToTen(compensoCard),
        compensoCashArrotondato: roundToTen(compensoCash),
        numeroAnomalie,
        numeroRecord: operatorRecords.length,
      };
    }).sort((a, b) => b.compensoTotale - a.compensoTotale);
  }, [records]);

  const globalStats = useMemo(() => {
    const totalCompenso = records.reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCard = records
      .filter((r) => r.categoriaCompenso === "card")
      .reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalCash = records
      .filter((r) => r.categoriaCompenso === "cash")
      .reduce((sum, r) => sum + r.compensoOperatore, 0);
    const totalAnomalie = records.filter((r) => r.hasAnomaly).length;

    return {
      totalRecords: records.length,
      totalOperators: operatorReports.length,
      totalCompenso: roundToTen(totalCompenso),
      totalCard: roundToTen(totalCard),
      totalCash: roundToTen(totalCash),
      totalAnomalie,
      cardPercentage: totalCompenso > 0 ? (totalCard / totalCompenso) * 100 : 0,
      cashPercentage: totalCompenso > 0 ? (totalCash / totalCompenso) * 100 : 0,
    };
  }, [records, operatorReports]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const selectedReport = selectedOperator
    ? operatorReports.find((r) => r.operatore === selectedOperator)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard Operatori</h2>
          <p className="text-muted-foreground">
            Riepilogo compensi e statistiche per operatore
          </p>
        </div>
        <Button onClick={onExportExcel} data-testid="button-export-excel">
          <Download className="mr-2 h-4 w-4" />
          Esporta Excel
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Compenso Totale</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCompenso)}</div>
            <p className="text-xs text-muted-foreground">
              Da {globalStats.totalRecords} prestazioni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <span role="img" aria-label="carta">💳</span> Carta
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCard)}</div>
            <div className="mt-2">
              <Progress value={globalStats.cardPercentage} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalStats.cardPercentage.toFixed(1)}% del totale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <span role="img" aria-label="contanti">💵</span> Contanti
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(globalStats.totalCash)}</div>
            <div className="mt-2">
              <Progress value={globalStats.cashPercentage} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {globalStats.cashPercentage.toFixed(1)}% del totale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Operatori</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalStats.totalOperators}</div>
            <div className="flex items-center gap-1 mt-1">
              {globalStats.totalAnomalie > 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {globalStats.totalAnomalie} anomalie
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Report per Operatore</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {operatorReports.map((report, index) => {
            const colors = [
              { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800", accent: "bg-blue-500", text: "text-blue-700 dark:text-blue-300" },
              { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-200 dark:border-emerald-800", accent: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
              { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-200 dark:border-violet-800", accent: "bg-violet-500", text: "text-violet-700 dark:text-violet-300" },
              { bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800", accent: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
              { bg: "bg-rose-50 dark:bg-rose-950/40", border: "border-rose-200 dark:border-rose-800", accent: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
              { bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800", accent: "bg-cyan-500", text: "text-cyan-700 dark:text-cyan-300" },
              { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", accent: "bg-orange-500", text: "text-orange-700 dark:text-orange-300" },
              { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-200 dark:border-indigo-800", accent: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-300" },
            ];
            const color = colors[index % colors.length];

            return (
              <div
                key={report.operatore}
                className={`rounded-lg border-2 p-5 ${color.bg} ${color.border}`}
                data-testid={`operator-card-${report.operatore}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full ${color.accent} text-white font-bold text-lg`}>
                    {report.operatore.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold text-lg truncate ${color.text}`}>{report.operatore}</h4>
                    <p className="text-sm text-muted-foreground">
                      {report.numeroRecord} prestazioni
                    </p>
                  </div>
                  {report.numeroAnomalie > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          {report.numeroAnomalie}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {report.numeroAnomalie} record con anomalia
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Compenso Totale</span>
                      <span className={`text-xl font-bold ${color.text}`}>
                        {formatCurrency(report.compensoTotaleArrotondato)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                      <div className="flex items-center gap-1 mb-1">
                        <span role="img" aria-label="carta">💳</span>
                        <span className="text-xs font-medium text-muted-foreground">Carta</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(report.compensoCardArrotondato)}
                      </p>
                    </div>
                    <div className="rounded-md bg-background/80 dark:bg-background/40 p-3 border">
                      <div className="flex items-center gap-1 mb-1">
                        <span role="img" aria-label="contanti">💵</span>
                        <span className="text-xs font-medium text-muted-foreground">Contanti</span>
                      </div>
                      <p className="text-lg font-semibold">
                        {formatCurrency(report.compensoCashArrotondato)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Importi arrotondati alla decina di euro
        </p>
      </div>
    </div>
  );
}
