import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckSquare, Square } from "lucide-react";

export interface DuplicateRecord {
  index: number;
  data: string;
  operatore: string;
  paziente: string;
  prestazione: string;
  elementiDentali: string;
}

interface DuplicateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateRecord[];
  onImportSelected: (excludeIndices: number[]) => void;
  totalRecords: number;
}

export function DuplicateModal({
  open,
  onOpenChange,
  duplicates,
  onImportSelected,
  totalRecords,
}: DuplicateModalProps) {
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<number>>(new Set());

  const handleSelectAll = () => {
    setSelectedDuplicates(new Set(duplicates.map(d => d.index)));
  };

  const handleDeselectAll = () => {
    setSelectedDuplicates(new Set());
  };

  const handleToggle = (index: number) => {
    const newSelected = new Set(selectedDuplicates);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedDuplicates(newSelected);
  };

  const handleImport = () => {
    const duplicateIndices = new Set(duplicates.map(d => d.index));
    const excludeIndices = duplicates
      .filter(d => !selectedDuplicates.has(d.index))
      .map(d => d.index);
    onImportSelected(excludeIndices);
    setSelectedDuplicates(new Set());
    onOpenChange(false);
  };

  const handleImportAll = () => {
    onImportSelected([]);
    setSelectedDuplicates(new Set());
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedDuplicates(new Set());
    onOpenChange(false);
  };

  const nonDuplicateCount = totalRecords - duplicates.length;
  const selectedCount = selectedDuplicates.size;
  const willImportCount = nonDuplicateCount + selectedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[72rem] h-[80vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Rilevati {duplicates.length} record duplicati
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground shrink-0 pb-2">
          <p>
            Sono stati trovati <strong>{duplicates.length}</strong> record già presenti nelle analisi archiviate.
          </p>
          <p className="mt-1">
            Seleziona quali duplicati vuoi comunque importare, oppure escludi tutti.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 pb-2">
          <Button variant="outline" size="sm" onClick={handleSelectAll} data-testid="button-select-all-duplicates">
            <CheckSquare className="mr-2 h-4 w-4" />
            Seleziona tutti
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeselectAll} data-testid="button-deselect-all-duplicates">
            <Square className="mr-2 h-4 w-4" />
            Deseleziona tutti
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 z-10">
              <tr>
                <th className="p-2 w-10"></th>
                <th className="text-left p-2 font-medium">Data</th>
                <th className="text-left p-2 font-medium">Operatore</th>
                <th className="text-left p-2 font-medium">Paziente</th>
                <th className="text-left p-2 font-medium">Prestazione</th>
                <th className="text-left p-2 font-medium">Elementi</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((dup) => (
                <tr
                  key={dup.index}
                  className={`border-t hover-elevate cursor-pointer ${
                    selectedDuplicates.has(dup.index) ? "bg-primary/10" : ""
                  }`}
                  onClick={() => handleToggle(dup.index)}
                  data-testid={`row-duplicate-${dup.index}`}
                >
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={selectedDuplicates.has(dup.index)}
                      onCheckedChange={() => handleToggle(dup.index)}
                      data-testid={`checkbox-duplicate-${dup.index}`}
                    />
                  </td>
                  <td className="p-2">{dup.data}</td>
                  <td className="p-2">{dup.operatore}</td>
                  <td className="p-2">{dup.paziente}</td>
                  <td className="p-2 max-w-[200px] truncate">{dup.prestazione}</td>
                  <td className="p-2">{dup.elementiDentali}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        <div className="text-sm text-muted-foreground shrink-0 pt-2">
          Record nuovi: <strong>{nonDuplicateCount}</strong> | 
          Duplicati selezionati: <strong>{selectedCount}</strong> | 
          Totale da importare: <strong>{willImportCount}</strong>
        </div>

        <DialogFooter className="shrink-0 gap-2 pt-2">
          <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-import">
            Annulla
          </Button>
          <Button variant="secondary" onClick={handleImportAll} data-testid="button-import-all">
            Importa tutti ({totalRecords})
          </Button>
          <Button onClick={handleImport} data-testid="button-import-selected">
            Importa selezionati ({willImportCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
