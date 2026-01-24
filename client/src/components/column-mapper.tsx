import { useState } from "react";
import { ArrowRight, Check, Save, Trash2, FileText, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { appFieldLabels, appFieldNames, type AppFieldName, type ColumnMapping } from "@shared/schema";

interface ColumnMapperProps {
  sourceColumns: string[];
  rawData: Record<string, string>[];
  savedMappings: ColumnMapping[];
  onMappingComplete: (mappings: Record<string, string>, dateRange: string) => void;
  onSaveMapping: (name: string, mappings: Record<string, string>) => void;
  onDeleteMapping: (id: string) => void;
}

export function ColumnMapper({
  sourceColumns,
  rawData,
  savedMappings,
  onMappingComplete,
  onSaveMapping,
  onDeleteMapping,
}: ColumnMapperProps) {
  const [mappings, setMappings] = useState<Record<AppFieldName, string>>({
    operatore: "",
    paziente: "",
    prestazione: "",
    elementiDentali: "",
    prezzoAlPaziente: "",
    compensoOperatore: "",
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newMappingName, setNewMappingName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const handleMappingChange = (appField: AppFieldName, sourceColumn: string) => {
    setMappings((prev) => ({ ...prev, [appField]: sourceColumn }));
  };

  const loadSavedMapping = (mapping: ColumnMapping) => {
    const newMappings = { ...mappings };
    appFieldNames.forEach((field) => {
      if (mapping.mappings[field] && sourceColumns.includes(mapping.mappings[field])) {
        newMappings[field] = mapping.mappings[field];
      }
    });
    setMappings(newMappings);
  };

  const isMappingComplete = appFieldNames.every((field) => mappings[field] !== "");
  const isDateComplete = dateFrom !== "" && dateTo !== "";
  const isComplete = isMappingComplete && isDateComplete;

  const formatDateRange = () => {
    if (!dateFrom || !dateTo) return "";
    const from = new Date(dateFrom).toLocaleDateString("it-IT");
    const to = new Date(dateTo).toLocaleDateString("it-IT");
    return `${from} - ${to}`;
  };

  const handleConfirm = () => {
    if (isComplete) {
      onMappingComplete(mappings, formatDateRange());
    }
  };

  const handleSaveMapping = () => {
    if (newMappingName.trim() && isMappingComplete) {
      onSaveMapping(newMappingName.trim(), mappings);
      setNewMappingName("");
      setShowSaveDialog(false);
    }
  };

  const previewData = rawData.slice(0, 3);

  const getUsedColumns = () => {
    return Object.values(mappings).filter(Boolean);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ArrowRight className="h-5 w-5 text-primary" />
                Mappatura Colonne
              </CardTitle>
              <CardDescription className="mt-1">
                Associa le colonne del file ai campi dell'applicazione
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {savedMappings.length > 0 && (
                <Select onValueChange={(id) => {
                  const mapping = savedMappings.find(m => m.id === id);
                  if (mapping) loadSavedMapping(mapping);
                }}>
                  <SelectTrigger className="w-[200px]" data-testid="select-saved-mapping">
                    <SelectValue placeholder="Carica mappatura..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savedMappings.map((mapping) => (
                      <SelectItem key={mapping.id} value={mapping.id}>
                        {mapping.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!isMappingComplete}
                    data-testid="button-save-mapping-dialog"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salva Mappatura
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Salva Mappatura</DialogTitle>
                    <DialogDescription>
                      Salva questa configurazione per riutilizzarla in futuro
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Label htmlFor="mapping-name">Nome della mappatura</Label>
                    <Input
                      id="mapping-name"
                      value={newMappingName}
                      onChange={(e) => setNewMappingName(e.target.value)}
                      placeholder="Es: Importazione Studio Dentistico"
                      className="mt-2"
                      data-testid="input-mapping-name"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Annulla
                    </Button>
                    <Button
                      onClick={handleSaveMapping}
                      disabled={!newMappingName.trim()}
                      data-testid="button-save-mapping-confirm"
                    >
                      Salva
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <Label className="font-medium">Periodo di riferimento dell'analisi</Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-from" className="text-sm text-muted-foreground">Data inizio</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="input-date-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to" className="text-sm text-muted-foreground">Data fine</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="input-date-to"
                />
              </div>
            </div>
            {isDateComplete && (
              <p className="mt-2 text-sm text-muted-foreground">
                L'analisi sara identificata come: <strong>{formatDateRange()}</strong>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appFieldNames.map((field) => (
              <div key={field} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {appFieldLabels[field]}
                  {mappings[field] && (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="mr-1 h-3 w-3" />
                      Mappato
                    </Badge>
                  )}
                </Label>
                <Select
                  value={mappings[field]}
                  onValueChange={(value) => handleMappingChange(field, value)}
                >
                  <SelectTrigger data-testid={`select-mapping-${field}`}>
                    <SelectValue placeholder="Seleziona colonna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceColumns.map((col) => (
                      <SelectItem
                        key={col}
                        value={col}
                        disabled={getUsedColumns().includes(col) && mappings[field] !== col}
                      >
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {isMappingComplete && previewData.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">
                Anteprima dati mappati (prime 3 righe)
              </h4>
              <ScrollArea className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {appFieldNames.map((field) => (
                        <TableHead key={field} className="whitespace-nowrap">
                          {appFieldLabels[field]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx}>
                        {appFieldNames.map((field) => (
                          <TableCell key={field} className="whitespace-nowrap">
                            {row[mappings[field]] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-4 flex-wrap border-t pt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              {Object.values(mappings).filter(Boolean).length} di {appFieldNames.length} campi mappati
              {!isDateComplete && " • Inserire il periodo"}
            </span>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!isComplete}
            data-testid="button-confirm-mapping"
          >
            <Check className="mr-2 h-4 w-4" />
            Conferma e Importa
          </Button>
        </CardFooter>
      </Card>

      {savedMappings.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Mappature Salvate</CardTitle>
            <CardDescription>
              Clicca su una mappatura per caricarla, o eliminala se non piu necessaria
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {savedMappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover-elevate cursor-pointer"
                  onClick={() => loadSavedMapping(mapping)}
                  data-testid={`mapping-item-${mapping.id}`}
                >
                  <div>
                    <p className="font-medium">{mapping.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Creata il {new Date(mapping.createdAt).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMapping(mapping.id);
                    }}
                    data-testid={`button-delete-mapping-${mapping.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
