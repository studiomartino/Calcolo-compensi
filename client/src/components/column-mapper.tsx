import { useState } from "react";
import { ArrowRight, Check, Save, Trash2, FileText } from "lucide-react";
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
  onMappingComplete: (mappings: Record<string, string>) => void;
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
    data: "",
    operatore: "",
    paziente: "",
    prestazione: "",
    elementiDentali: "",
    prezzoAlPaziente: "",
    compensoOperatore: "",
  });
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

  const handleConfirm = () => {
    if (isMappingComplete) {
      onMappingComplete(mappings);
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
                Associa le colonne del file ai campi dell'applicazione. Il periodo dell'analisi verra determinato automaticamente dalle date presenti nei dati.
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
          <div className="space-y-3">
            {appFieldNames.map((field) => (
              <div key={field} className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0">
                <div className="flex items-center gap-3 min-w-[180px]">
                  <Label className="font-medium text-sm">
                    {appFieldLabels[field]}
                  </Label>
                  {mappings[field] && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <Select
                  value={mappings[field]}
                  onValueChange={(value) => handleMappingChange(field, value)}
                >
                  <SelectTrigger className="w-[280px]" data-testid={`select-mapping-${field}`}>
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
            </span>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={!isMappingComplete}
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
