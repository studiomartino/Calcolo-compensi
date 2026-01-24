import { useState, useMemo } from "react";
import { AlertTriangle, Search, Filter, CheckCircle2, XCircle, Edit2, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { CompensoRecord } from "@shared/schema";

interface DataTableProps {
  records: CompensoRecord[];
  operators: string[];
  onCategoryChange: (id: string, checked: boolean) => void;
  onRecordEdit: (id: string, field: keyof CompensoRecord, value: string | number) => void;
}

export function DataTable({ records, operators, onCategoryChange, onRecordEdit }: DataTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [anomalyFilter, setAnomalyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

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
        (categoryFilter === "selected" && record.categoriaCompenso) ||
        (categoryFilter === "unselected" && !record.categoriaCompenso);

      return matchesSearch && matchesOperator && matchesAnomaly && matchesCategory;
    });
  }, [records, searchTerm, operatorFilter, anomalyFilter, categoryFilter]);

  const stats = useMemo(() => {
    const total = records.length;
    const anomalies = records.filter((r) => r.hasAnomaly).length;
    const selected = records.filter((r) => r.categoriaCompenso).length;
    return { total, anomalies, selected };
  }, [records]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl">Dati Importati</CardTitle>
            <CardDescription className="mt-1">
              {stats.total} record totali • {stats.anomalies} anomalie • {stats.selected} categorizzati
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
              <SelectItem value="selected">Categoria selezionata</SelectItem>
              <SelectItem value="unselected">Categoria non selezionata</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Categoria</TableHead>
                <TableHead>Operatore</TableHead>
                <TableHead>Paziente</TableHead>
                <TableHead>Prestazione</TableHead>
                <TableHead>Elementi Dentali</TableHead>
                <TableHead className="text-right">Prezzo Paziente</TableHead>
                <TableHead className="text-right">Compenso Operatore</TableHead>
                <TableHead className="w-[80px] text-center">Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
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
                    className={record.hasAnomaly ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                    data-testid={`row-${record.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={record.categoriaCompenso}
                        onCheckedChange={(checked) => onCategoryChange(record.id, checked as boolean)}
                        data-testid={`checkbox-category-${record.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {renderEditableCell(record, "operatore", record.operatore)}
                    </TableCell>
                    <TableCell>
                      {renderEditableCell(record, "paziente", record.paziente)}
                    </TableCell>
                    <TableCell>
                      {renderEditableCell(record, "prestazione", record.prestazione)}
                    </TableCell>
                    <TableCell>
                      {renderEditableCell(record, "elementiDentali", record.elementiDentali)}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEditableCell(record, "prezzoAlPaziente", record.prezzoAlPaziente, true)}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderEditableCell(record, "compensoOperatore", record.compensoOperatore, true)}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.hasAnomaly ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 cursor-help">
                              <AlertTriangle className="h-3 w-3" />
                            </Badge>
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
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                          <CheckCircle2 className="h-3 w-3" />
                        </Badge>
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
            Clicca su una cella per modificarla
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
