import { useState } from "react";
import { Archive, Calendar, Trash2, FileText, Users, ChevronDown, ChevronUp, CreditCard, Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Analysis } from "@shared/schema";

interface AnalysisArchiveProps {
  analyses: Analysis[];
  onDeleteAnalysis: (id: string) => void;
  isLoading?: boolean;
}

export function AnalysisArchive({ analyses, onDeleteAnalysis, isLoading }: AnalysisArchiveProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const getAnalysisStats = (analysis: Analysis) => {
    const records = analysis.records;
    const totalCompenso = records.reduce((sum, r) => sum + r.compensoOperatore, 0);
    const cardCompenso = records.filter(r => r.categoriaCompenso === "card").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const cashCompenso = records.filter(r => r.categoriaCompenso === "cash").reduce((sum, r) => sum + r.compensoOperatore, 0);
    const uniqueOperators = new Set(records.map(r => r.operatore)).size;
    const anomalies = records.filter(r => r.hasAnomaly).length;

    return {
      totalRecords: records.length,
      totalCompenso: roundToTen(totalCompenso),
      cardCompenso: roundToTen(cardCompenso),
      cashCompenso: roundToTen(cashCompenso),
      uniqueOperators,
      anomalies,
    };
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento archivio...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analyses.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Archive className="h-12 w-12 opacity-40" />
            <p className="font-medium">Nessuna analisi archiviata</p>
            <p className="text-sm text-center max-w-md">
              Le analisi precedenti verranno automaticamente archiviate quando importi nuovi dati
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Archive className="h-5 w-5 text-primary" />
              Archivio Analisi
            </CardTitle>
            <CardDescription className="mt-1">
              {analyses.length} analisi archiviate
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {analyses.map((analysis) => {
          const stats = getAnalysisStats(analysis);
          const isExpanded = expandedId === analysis.id;

          return (
            <Collapsible
              key={analysis.id}
              open={isExpanded}
              onOpenChange={(open) => setExpandedId(open ? analysis.id : null)}
            >
              <div className="rounded-lg border">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{analysis.dateRange}</p>
                        <Badge variant="secondary" className="text-xs">
                          {stats.totalRecords} record
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {stats.uniqueOperators} operatori
                        </span>
                        <span>Totale: {formatCurrency(stats.totalCompenso)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" /> {formatCurrency(stats.cardCompenso)}</span>
                        <span className="flex items-center gap-1"><Banknote className="h-3 w-3" /> {formatCurrency(stats.cashCompenso)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Archiviata il {new Date(analysis.createdAt).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-expand-${analysis.id}`}>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-analysis-${analysis.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina analisi</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare l'analisi "{analysis.dateRange}"?
                            Questa azione non puo essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteAnalysis(analysis.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CollapsibleContent>
                  <div className="border-t p-4">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Riepilogo per operatore
                    </h4>
                    <ScrollArea className="max-h-[300px] rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Operatore</TableHead>
                            <TableHead className="text-right">Prestazioni</TableHead>
                            <TableHead className="text-right"><span className="flex items-center justify-end gap-1"><CreditCard className="h-3 w-3" /> Carta</span></TableHead>
                            <TableHead className="text-right"><span className="flex items-center justify-end gap-1"><Banknote className="h-3 w-3" /> Contanti</span></TableHead>
                            <TableHead className="text-right">Totale</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Array.from(
                            analysis.records.reduce((acc, record) => {
                              const existing = acc.get(record.operatore) || {
                                count: 0,
                                card: 0,
                                cash: 0,
                                total: 0,
                              };
                              existing.count++;
                              if (record.categoriaCompenso === "card") {
                                existing.card += record.compensoOperatore;
                              } else {
                                existing.cash += record.compensoOperatore;
                              }
                              existing.total += record.compensoOperatore;
                              acc.set(record.operatore, existing);
                              return acc;
                            }, new Map<string, { count: number; card: number; cash: number; total: number }>())
                          )
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([operatore, data]) => (
                              <TableRow key={operatore}>
                                <TableCell className="font-medium">{operatore}</TableCell>
                                <TableCell className="text-right">{data.count}</TableCell>
                                <TableCell className="text-right">{formatCurrency(roundToTen(data.card))}</TableCell>
                                <TableCell className="text-right">{formatCurrency(roundToTen(data.cash))}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatCurrency(roundToTen(data.total))}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
