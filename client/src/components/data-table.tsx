import { useState, useMemo } from "react";
import { AlertTriangle, Search, Filter, CheckCircle2, Edit2, Check, X, CreditCard, Banknote, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { CompensoRecord, CategoriaCompenso } from "@shared/schema";

function TruncatedCell({ text, maxWidth = "150px" }: { text: string; maxWidth?: string }) {
  if (!text) return <span className="text-muted-foreground">-</span>;
  
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <span 
          className="block cursor-default line-clamp-2 text-sm leading-tight" 
          style={{ maxWidth }}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="whitespace-pre-wrap">{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface DataTableProps {
  records: CompensoRecord[];
  operators: string[];
  onCategoryChange: (ids: string[], category: CategoriaCompenso) => void;
  onRecordEdit: (id: string, field: keyof CompensoRecord, value: string | number) => void;
}

export function DataTable({ records, operators, onCategoryChange, onRecordEdit }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        searchTerm === "" ||
        record.operatore.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.paziente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.prestazione.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOperator =
        operatorFilter === "all" || record.operatore === operatorFilter;

      const matchesAnomaly =
        anomalyFilter === "all" ||
        (anomalyFilter === "anomaly" && record.hasAnomaly) ||
        (anomalyFilter === "normal" && !record.hasAnomaly);

      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "card" && record.categoriaCompenso === "card") ||
        (categoryFilter === "cash" && record.categoriaCompenso === "cash");

      return matchesSearch && matchesOperator && matchesAnomaly && matchesCategory;
    });
  }, [records, searchTerm, operatorFilter, anomalyFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const anomalies = records.filter((r) => r.hasAnomaly).length;
    const cardCount = records.filter((r) => r.categoriaCompenso === "card").length;
    const cashCount = records.filter((r) => r.categoriaCompenso === "cash").length;
    return { total, anomalies, cardCount, cashCount };
  }, [records]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const handleStartEdit = (id: string, field: string, currentValue: string | number) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  };

  const handleSaveEdit = (id: string, field: keyof CompensoRecord) => {
    if (field === "prezzoAlPaziente" || field === "compensoOperatore") {
      const numValue = parseFloat(editValue.replace(",", "."));
      if (!isNaN(numValue)) {
        onRecordEdit(id, field, numValue);
      }
    } else {
      onRecordEdit(id, field, editValue);
    }
    setEditingCell(null);
    setEditValue("");
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    } else {
      setSelectedRecords(new Set());
    }
  };

  const handleSelectRecord = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRecords);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRecords(newSelected);
  };

  const handleBulkCategoryChange = (category: CategoriaCompenso) => {
    if (selectedRecords.size > 0) {
      onCategoryChange(Array.from(selectedRecords), category);
      setSelectedRecords(new Set());
    }
  };

  const handleSingleCategoryToggle = (record: CompensoRecord) => {
    const newCategory: CategoriaCompenso = record.categoriaCompenso === "card" ? "cash" : "card";
    onCategoryChange([record.id], newCategory);
  };

  const renderEditableCell = (
    record: CompensoRecord,
    field: keyof CompensoRecord,
    value: string | number,
    isNumeric: boolean = false
  ) => {
    const isEditing = editingCell?.id === record.id && editingCell?.field === field;

    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 w-24 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit(record.id, field);
              if (e.key === "Escape") handleCancelEdit();
            }}
            data-testid={`input-edit-${field}-${record.id}`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => handleSaveEdit(record.id, field)}
            data-testid={`button-save-edit-${record.id}`}
          >
            <Check className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleCancelEdit}
            data-testid={`button-cancel-edit-${record.id}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div
        className="group flex items-center gap-2 cursor-pointer"
        onClick={() => handleStartEdit(record.id, field, value)}
        data-testid={`cell-${field}-${record.id}`}
      >
        <span className={isNumeric ? "font-mono" : ""}>
          {isNumeric ? formatCurrency(value as number) : value}
        </span>
        <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    );
  };

  const allFilteredSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedRecords.has(r.id));
  const someFilteredSelected = filteredRecords.some(r => selectedRecords.has(r.id));

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl">Dati Importati</CardTitle>
            <CardDescription className="mt-1">
              {stats.total} record totali | {stats.anomalies} anomalie | Carta: {stats.cardCount} | Contanti: {stats.cashCount}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {stats.anomalies > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {stats.anomalies} Anomalie
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg border">
          <span className="text-sm font-medium text-muted-foreground mr-2">Azioni:</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedRecords(new Set(filteredRecords.map(r => r.id)))}
            data-testid="button-select-all-visible"
          >
            <CheckCircle2 className="mr-1 h-4 w-4" />
            Seleziona tutti
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedRecords(new Set())}
            disabled={selectedRecords.size === 0}
            data-testid="button-deselect-all"
          >
            <X className="mr-1 h-4 w-4" />
            Deseleziona tutti
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkCategoryChange("card")}
            disabled={selectedRecords.size === 0}
            data-testid="button-set-card"
          >
            <CreditCard className="mr-1 h-4 w-4" />
            Carta
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBulkCategoryChange("cash")}
            disabled={selectedRecords.size === 0}
            data-testid="button-set-cash"
          >
            <Banknote className="mr-1 h-4 w-4" />
            Contante
          </Button>
          {selectedRecords.size > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedRecords.size} selezionati
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cerca per operatore, paziente o prestazione..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-operator-filter">
              <SelectValue placeholder="Tutti gli operatori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli operatori</SelectItem>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anomalyFilter} onValueChange={setAnomalyFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-anomaly-filter">
              <SelectValue placeholder="Tutti i record" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i record</SelectItem>
              <SelectItem value="anomaly">Solo anomalie</SelectItem>
              <SelectItem value="normal">Solo normali</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
              <SelectValue placeholder="Tutte le categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le categorie</SelectItem>
              <SelectItem value="card">Carta</SelectItem>
              <SelectItem value="cash">Contanti</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px] px-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="w-[50px] px-2 text-center">Cat.</TableHead>
                <TableHead className="w-[90px] px-2 text-center">Data</TableHead>
                <TableHead className="w-[120px] px-2">Operatore</TableHead>
                <TableHead className="w-[120px] px-2">Paziente</TableHead>
                <TableHead className="w-[160px] px-2">Prestazione</TableHead>
                <TableHead className="w-[100px] px-2 text-center">Elementi</TableHead>
                <TableHead className="w-[100px] px-2 text-center">Prezzo Paz.</TableHead>
                <TableHead className="w-[120px] px-2 text-center">Compenso Op.</TableHead>
                <TableHead className="w-[40px] px-2 text-center"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Filter className="h-8 w-8" />
                      <p>Nessun record trovato con i filtri selezionati</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className={record.hasAnomaly 
                      ? "bg-red-50 dark:bg-red-950/40 border-l-2 border-l-red-400 dark:border-l-red-600" 
                      : ""}
                    data-testid={`row-${record.id}`}
                  >
                    <TableCell className="px-2">
                      <Checkbox
                        checked={selectedRecords.has(record.id)}
                        onCheckedChange={(checked) => handleSelectRecord(record.id, checked as boolean)}
                        data-testid={`checkbox-select-${record.id}`}
                      />
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSingleCategoryToggle(record)}
                            className="h-8 w-8 hover-elevate"
                            data-testid={`button-category-${record.id}`}
                          >
                            {record.categoriaCompenso === "card" ? (
                              <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clicca per cambiare categoria</p>
                          <p className="text-xs text-muted-foreground">
                            Attuale: {record.categoriaCompenso === "card" ? "Carta" : "Contanti"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="px-2 text-center text-sm tabular-nums">
                      {formatDate(record.data || "")}
                    </TableCell>
                    <TableCell className="px-2 font-medium">
                      <TruncatedCell text={record.operatore} maxWidth="110px" />
                    </TableCell>
                    <TableCell className="px-2">
                      <TruncatedCell text={record.paziente} maxWidth="110px" />
                    </TableCell>
                    <TableCell className="px-2">
                      <TruncatedCell text={record.prestazione} maxWidth="150px" />
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      <TruncatedCell text={record.elementiDentali} maxWidth="90px" />
                    </TableCell>
                    <TableCell className="px-2 text-center font-mono text-sm">
                      {formatCurrency(record.prezzoAlPaziente)}
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      {renderEditableCell(record, "compensoOperatore", record.compensoOperatore, true)}
                    </TableCell>
                    <TableCell className="px-2 text-center">
                      {record.hasAnomaly ? (
                        <Tooltip delayDuration={100}>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">Anomalia Rilevata</p>
                            <p className="text-sm">
                              Il compenso operatore ({formatCurrency(record.compensoOperatore)})
                              è uguale al prezzo paziente ({formatCurrency(record.prezzoAlPaziente)})
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 dark:text-green-400" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Visualizzati {filteredRecords.length} di {records.length} record
          </span>
          <span>
            Clicca sul compenso operatore per modificarlo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
