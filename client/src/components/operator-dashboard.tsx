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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Report per Operatore</CardTitle>
            <CardDescription>
              Clicca su un operatore per vedere i dettagli
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {operatorReports.map((report) => {
                const isSelected = selectedOperator === report.operatore;
                const cardPercentage =
                  report.compensoTotale > 0
                    ? (report.compensoCard / report.compensoTotale) * 100
                    : 0;

                return (
                  <div
                    key={report.operatore}
                    className={`flex items-center justify-between rounded-lg border p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "hover-elevate"
                    }`}
                    onClick={() =>
                      onSelectOperator(isSelected ? null : report.operatore)
                    }
                    data-testid={`operator-card-${report.operatore}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                        {report.operatore.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{report.operatore}</p>
                          {report.numeroAnomalie > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
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
                        <p className="text-sm text-muted-foreground">
                          {report.numeroRecord} prestazioni
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(report.compensoTotaleArrotondato)}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span role="img" aria-label="carta">💳</span>
                          {formatCurrency(report.compensoCardArrotondato)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span role="img" aria-label="contanti">💵</span>
                          {formatCurrency(report.compensoCashArrotondato)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {selectedReport ? selectedReport.operatore : "Dettagli Operatore"}
            </CardTitle>
            <CardDescription>
              {selectedReport
                ? `${selectedReport.numeroRecord} prestazioni registrate`
                : "Seleziona un operatore per vedere i dettagli"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedReport ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Compenso Totale</span>
                    <span className="font-semibold">
                      {formatCurrency(selectedReport.compensoTotaleArrotondato)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span role="img" aria-label="carta">💳</span> Carta
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(selectedReport.compensoCardArrotondato)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span role="img" aria-label="contanti">💵</span> Contanti
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(selectedReport.compensoCashArrotondato)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Distribuzione per categoria
                  </p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>💳 Carta</span>
                        <span>{selectedReport.compensoTotale > 0 ? ((selectedReport.compensoCard / selectedReport.compensoTotale) * 100).toFixed(0) : 0}%</span>
                      </div>
                      <Progress
                        value={selectedReport.compensoTotale > 0 ? (selectedReport.compensoCard / selectedReport.compensoTotale) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>💵 Contanti</span>
                        <span>{selectedReport.compensoTotale > 0 ? ((selectedReport.compensoCash / selectedReport.compensoTotale) * 100).toFixed(0) : 0}%</span>
                      </div>
                      <Progress
                        value={selectedReport.compensoTotale > 0 ? (selectedReport.compensoCash / selectedReport.compensoTotale) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>

                {selectedReport.numeroAnomalie > 0 && (
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        {selectedReport.numeroAnomalie} Anomalie
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
                      Record con compenso uguale al prezzo paziente
                    </p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground text-center">
                  Importi arrotondati alla decina di euro
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mb-4 opacity-40" />
                <p>Nessun operatore selezionato</p>
                <p className="text-sm">
                  Clicca su un operatore dalla lista per vedere i dettagli del report
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
