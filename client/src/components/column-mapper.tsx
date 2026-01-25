import { useState, useMemo } from "react";
import { ArrowRight, Check, Save, Trash2, FileText, Palette, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { appFieldLabels, appFieldNames, type AppFieldName, type ColumnMapping } from "@shared/schema";

export const OPERATOR_COLORS = [
  { name: "Blu scuro", hex: "#005493" },
  { name: "Giallo", hex: "#FFFB00" },
  { name: "Verde lime", hex: "#00F900" },
  { name: "Rosso", hex: "#FF2600" },
  { name: "Arancione", hex: "#FF9300" },
  { name: "Argento", hex: "#C0C0C0" },
  { name: "Verde menta", hex: "#9BD9B5" },
  { name: "Verde scuro", hex: "#008F00" },
  { name: "Ciano", hex: "#00FDFF" },
  { name: "Rosa salmone", hex: "#FF7E79" },
  { name: "Viola", hex: "#9437FF" },
  { name: "Rosa chiaro", hex: "#FF8AD8" },
  { name: "Fucsia", hex: "#FF2F92" },
  { name: "Bordeaux", hex: "#941751" },
  { name: "Bianco", hex: "#FFFFFF" },
  { name: "Nero", hex: "#000000" },
  { name: "Blu elettrico", hex: "#0433FF" },
  { name: "Teal", hex: "#14B8A6" },
];

interface ColumnMapperProps {
  sourceColumns: string[];
  rawData: Record<string, string>[];
  savedMappings: ColumnMapping[];
  onMappingComplete: (mappings: Record<string, string>) => void;
  onSaveMapping: (name: string, mappings: Record<string, string>) => void;
  onDeleteMapping: (id: string) => void;
  operatorColors: Record<string, string>;
  onUpdateOperatorColors: (colors: Record<string, string>) => void;
}

export function ColumnMapper({
  sourceColumns,
  rawData,
  savedMappings,
  onMappingComplete,
  onSaveMapping,
  onDeleteMapping,
  operatorColors,
  onUpdateOperatorColors,
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
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [tempColors, setTempColors] = useState<Record<string, string>>({});

  const operatorsInData = useMemo(() => {
    if (!mappings.operatore) return [];
    const ops = new Set<string>();
    rawData.forEach((row) => {
      const op = row[mappings.operatore];
      if (op && op.trim()) ops.add(op.trim());
    });
    return Array.from(ops).sort();
  }, [rawData, mappings.operatore]);

  const newOperators = useMemo(() => {
    return operatorsInData.filter((op) => !operatorColors[op]);
  }, [operatorsInData, operatorColors]);

  const openColorDialog = () => {
    const initial: Record<string, string> = {};
    operatorsInData.forEach((op) => {
      initial[op] = operatorColors[op] || "";
    });
    setTempColors(initial);
    setShowColorDialog(true);
  };

  const handleColorChange = (operator: string, color: string) => {
    setTempColors((prev) => ({ ...prev, [operator]: color }));
  };

  const handleSaveColors = () => {
    const updatedColors = { ...operatorColors };
    Object.entries(tempColors).forEach(([op, color]) => {
      if (color) {
        updatedColors[op] = color;
      }
    });
    onUpdateOperatorColors(updatedColors);
    setShowColorDialog(false);
  };

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
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-right ml-[250px] mr-[250px]">
            {appFieldNames.map((field) => (
              <div key={field} className="flex items-center gap-3 py-2 border-b last:border-b-0">
                <Label className="font-medium text-sm w-[160px] shrink-0">
                  {appFieldLabels[field]}
                </Label>
                <Select
                  value={mappings[field]}
                  onValueChange={(value) => handleMappingChange(field, value)}
                >
                  <SelectTrigger className="w-[260px]" data-testid={`select-mapping-${field}`}>
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
                {mappings[field] && (
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                )}
              </div>
            ))}
          </div>

          {isMappingComplete && previewData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">
                  Anteprima dati mappati (prime 3 righe)
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openColorDialog}
                  className="gap-2"
                  data-testid="button-operator-colors"
                >
                  <Palette className="h-4 w-4" />
                  Colori Operatori
                  {newOperators.length > 0 && (
                    <Badge variant="destructive" className="ml-1">
                      {newOperators.length} nuovi
                    </Badge>
                  )}
                </Button>
              </div>
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
          <div className="flex items-center gap-2">
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
            <Button
              onClick={handleConfirm}
              disabled={!isMappingComplete}
              data-testid="button-confirm-mapping"
            >
              <Check className="mr-2 h-4 w-4" />
              Conferma e Importa
            </Button>
          </div>
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

      <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Colori Operatori
            </DialogTitle>
            <DialogDescription>
              Assegna un colore a ciascun operatore per distinguerli nei report
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {newOperators.length > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm">
                  {newOperators.length} nuov{newOperators.length === 1 ? 'o' : 'i'} operator{newOperators.length === 1 ? 'e' : 'i'} senza colore assegnato
                </span>
              </div>
            )}
            
            <div className="space-y-3">
              {operatorsInData.map((operator) => (
                <div key={operator} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{operator}</p>
                    {!operatorColors[operator] && (
                      <span className="text-xs text-amber-500">Nuovo operatore</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {OPERATOR_COLORS.map((color) => (
                      <Tooltip key={color.hex}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={`w-6 h-6 rounded-md border-2 transition-all ${
                              tempColors[operator] === color.hex
                                ? "border-primary scale-110"
                                : "border-transparent hover:scale-105"
                            }`}
                            style={{ backgroundColor: color.hex }}
                            onClick={() => handleColorChange(operator, color.hex)}
                            data-testid={`color-${operator}-${color.name}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>{color.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                  {tempColors[operator] && (
                    <div 
                      className="w-8 h-8 rounded-md border"
                      style={{ backgroundColor: tempColors[operator] }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColorDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveColors} data-testid="button-save-colors">
              Salva Colori
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
