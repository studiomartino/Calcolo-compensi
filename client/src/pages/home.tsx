import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapper, OPERATOR_COLORS } from "@/components/column-mapper";
import { DataTable } from "@/components/data-table";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { AnalysisArchive } from "@/components/analysis-archive";
import { OperatorsTab } from "@/components/operators-tab";
import { UsersTab } from "@/components/users-tab";
import { DuplicateModal, DuplicateRecord } from "@/components/duplicate-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Table, BarChart3, Upload, Archive, FileSpreadsheet, Users as UsersIcon, FolderArchive, UserCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import type { CompensoRecord, ColumnMapping, Analysis, CategoriaCompenso, Operator } from "@shared/schema";

const OPERATOR_COLORS_KEY = "operatorColors";

type ImportStep = "upload" | "mapping";

interface HomeProps {
  userRole: "admin" | "user";
}

export default function Home({ userRole }: HomeProps) {
  const [mainTab, setMainTab] = useState<string>("import");
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [operatorColors, setOperatorColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(OPERATOR_COLORS_KEY);
    return saved ? JSON.parse(saved) : {};
  });
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
  const [pendingMappings, setPendingMappings] = useState<Record<string, string> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpdateOperatorColors = useCallback((colors: Record<string, string>) => {
    setOperatorColors(colors);
    localStorage.setItem(OPERATOR_COLORS_KEY, JSON.stringify(colors));
  }, []);

  const assignRandomColors = useCallback((operators: string[]) => {
    const usedColors = new Set(Object.values(operatorColors));
    const availableColors = OPERATOR_COLORS.filter((c) => !usedColors.has(c.hex));
    const newColors = { ...operatorColors };
    
    operators.forEach((op) => {
      if (!newColors[op]) {
        if (availableColors.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableColors.length);
          newColors[op] = availableColors[randomIndex].hex;
          availableColors.splice(randomIndex, 1);
        } else {
          const randomIndex = Math.floor(Math.random() * OPERATOR_COLORS.length);
          newColors[op] = OPERATOR_COLORS[randomIndex].hex;
        }
      }
    });
    
    handleUpdateOperatorColors(newColors);
    return newColors;
  }, [operatorColors, handleUpdateOperatorColors]);

  const { data: records = [], isLoading: isLoadingRecords } = useQuery<CompensoRecord[]>({
    queryKey: ["/api/records"],
  });

  const { data: mappings = [] } = useQuery<ColumnMapping[]>({
    queryKey: ["/api/mappings"],
  });

  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const { data: managedOperators = [], refetch: refetchOperators } = useQuery<Operator[]>({
    queryKey: ["/api/operators"],
  });

  const importMutation = useMutation({
    mutationFn: async (data: { records: Record<string, string>[]; mappings: Record<string, string> }) => {
      const response = await apiRequest("POST", "/api/records/import", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setCurrentDateRange(data.dateRange || "");
      setMainTab("analysis");
      setImportStep("upload");
      setRawData([]);
      setSourceColumns([]);
      toast({
        title: "Importazione completata",
        description: `${data.count} record importati - ${data.analysisName || "Analisi"}`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'importazione",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ ids, category }: { ids: string[]; category: CategoriaCompenso }) => {
      const response = await apiRequest("PATCH", "/api/records/bulk/update", { ids, updates: { categoriaCompenso: category } });
      return response.json();
    },
    onSuccess: (data: { updated: number; records: CompensoRecord[] }) => {
      queryClient.setQueryData<CompensoRecord[]>(["/api/records"], (oldRecords) => {
        if (!oldRecords) return oldRecords;
        const updatedMap = new Map(data.records.map(r => [r.id, r]));
        return oldRecords.map(record => updatedMap.get(record.id) || record);
      });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string | number }) => {
      return apiRequest("PATCH", `/api/records/${id}`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({
        title: "Record aggiornato",
        description: "Le modifiche sono state salvate",
      });
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: async ({ name, mappings }: { name: string; mappings: Record<string, string> }) => {
      return apiRequest("POST", "/api/mappings", { name, mappings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Mappatura salvata",
        description: "La mappatura è stata salvata per usi futuri",
      });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mappings"] });
      toast({
        title: "Mappatura eliminata",
        description: "La mappatura è stata eliminata",
      });
    },
  });

  const deleteAnalysisMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/analyses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      toast({
        title: "Analisi eliminata",
        description: "L'analisi è stata rimossa dall'archivio",
      });
    },
  });

  const bulkDeleteAnalysesMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("POST", "/api/analyses/bulk-delete", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      toast({
        title: "Analisi eliminate",
        description: "Le analisi selezionate sono state rimosse dall'archivio",
      });
    },
  });

  const archiveCurrentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/records/archive");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
      setCurrentDateRange("");
      toast({
        title: "Analisi archiviata",
        description: "L'analisi corrente è stata archiviata con successo",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'archiviazione",
        variant: "destructive",
      });
    },
  });

  const operators = useMemo(() => {
    const uniqueOperators = new Set(records.map((r) => r.operatore));
    return Array.from(uniqueOperators).sort();
  }, [records]);

  const handleDataLoaded = useCallback((data: Record<string, string>[], columns: string[]) => {
    setRawData(data);
    setSourceColumns(columns);
    setImportStep("mapping");
  }, []);

  const handleMappingComplete = useCallback(async (fieldMappings: Record<string, string>) => {
    const operatorField = fieldMappings.operatore;
    if (operatorField) {
      const operators = new Set<string>();
      rawData.forEach((row) => {
        const op = row[operatorField];
        if (op && op.trim()) operators.add(op.trim());
      });
      const operatorsWithoutColors = Array.from(operators).filter((op) => !operatorColors[op]);
      if (operatorsWithoutColors.length > 0) {
        assignRandomColors(operatorsWithoutColors);
      }
    }
    
    try {
      const response = await apiRequest("POST", "/api/records/check-duplicates", {
        records: rawData,
        mappings: fieldMappings,
      });
      const result = await response.json();
      
      if (result.hasDuplicates && result.duplicates.length > 0) {
        setDuplicates(result.duplicates);
        setPendingMappings(fieldMappings);
        setDuplicateModalOpen(true);
      } else {
        importMutation.mutate({
          records: rawData,
          mappings: fieldMappings,
        });
      }
    } catch (error) {
      importMutation.mutate({
        records: rawData,
        mappings: fieldMappings,
      });
    }
  }, [rawData, importMutation, operatorColors, assignRandomColors]);

  const handleImportWithExclusions = useCallback((excludeIndices: number[]) => {
    if (!pendingMappings) return;
    
    const excludeSet = new Set(excludeIndices);
    const filteredRecords = rawData.filter((_, index) => !excludeSet.has(index));
    
    importMutation.mutate({
      records: filteredRecords,
      mappings: pendingMappings,
    });
    
    setPendingMappings(null);
    setDuplicates([]);
  }, [rawData, pendingMappings, importMutation]);

  const handleCategoryChange = useCallback((ids: string[], category: CategoriaCompenso) => {
    updateCategoryMutation.mutate({ ids, category });
  }, [updateCategoryMutation]);

  const handleRecordEdit = useCallback((id: string, field: keyof CompensoRecord, value: string | number) => {
    updateRecordMutation.mutate({ id, field, value });
  }, [updateRecordMutation]);

  const handleSaveMapping = useCallback((name: string, fieldMappings: Record<string, string>) => {
    saveMappingMutation.mutate({ name, mappings: fieldMappings });
  }, [saveMappingMutation]);

  const handleDeleteMapping = useCallback((id: string) => {
    deleteMappingMutation.mutate(id);
  }, [deleteMappingMutation]);

  const handleDeleteAnalysis = useCallback((id: string) => {
    deleteAnalysisMutation.mutate(id);
  }, [deleteAnalysisMutation]);

  const handleBulkDeleteAnalyses = useCallback((ids: string[]) => {
    bulkDeleteAnalysesMutation.mutate(ids);
  }, [bulkDeleteAnalysesMutation]);

  const handleOpenAnalysis = useCallback(async (analysis: Analysis) => {
    try {
      await apiRequest("POST", "/api/records/import", { 
        records: analysis.records.map(r => ({
          data: r.data || "",
          operatore: r.operatore,
          paziente: r.paziente,
          prestazione: r.prestazione,
          elementiDentali: r.elementiDentali,
          prezzoAlPaziente: r.prezzoAlPaziente.toString(),
          compensoOperatore: r.compensoOperatore.toString(),
          categoriaCompenso: r.categoriaCompenso,
        })),
        mappings: {
          data: "data",
          operatore: "operatore",
          paziente: "paziente",
          prestazione: "prestazione",
          elementiDentali: "elementiDentali",
          prezzoAlPaziente: "prezzoAlPaziente",
          compensoOperatore: "compensoOperatore",
        },
        preserveCategories: true,
      });
      
      await queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      setCurrentDateRange(analysis.dateRange);
      setMainTab("analysis");
      
      toast({
        title: "Analisi caricata",
        description: `${analysis.name} aperta con successo`,
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante l'apertura dell'analisi",
        variant: "destructive",
      });
    }
  }, [queryClient, toast]);

  const handleArchiveCurrent = useCallback(() => {
    archiveCurrentMutation.mutate();
  }, [archiveCurrentMutation]);

  const roundToTen = (value: number): number => {
    return Math.round(value / 10) * 10;
  };

  const handleExportExcel = useCallback(() => {
    const operatorMap = new Map<string, CompensoRecord[]>();
    records.forEach((record) => {
      const existing = operatorMap.get(record.operatore) || [];
      existing.push(record);
      operatorMap.set(record.operatore, existing);
    });

    const reportData = Array.from(operatorMap.entries()).map(([operatore, operatorRecords]) => {
      const compensoTotale = operatorRecords.reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCard = operatorRecords
        .filter((r) => r.categoriaCompenso === "card")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const compensoCash = operatorRecords
        .filter((r) => r.categoriaCompenso === "cash")
        .reduce((sum, r) => sum + r.compensoOperatore, 0);
      const numeroAnomalie = operatorRecords.filter((r) => r.hasAnomaly).length;

      return {
        Operatore: operatore,
        "Numero Prestazioni": operatorRecords.length,
        "Compenso Totale": roundToTen(compensoTotale),
        "Compenso A": roundToTen(compensoCard),
        "Compenso B": roundToTen(compensoCash),
        "Anomalie": numeroAnomalie,
      };
    });

    const detailData = records.map((r) => ({
      "Categoria": r.categoriaCompenso === "card" ? "Compenso A" : "Compenso B",
      Data: r.data || "",
      Operatore: r.operatore,
      Paziente: r.paziente,
      Prestazione: r.prestazione,
      "Elementi Dentali": r.elementiDentali,
      "Prezzo Paziente": r.prezzoAlPaziente,
      "Compenso Operatore": r.compensoOperatore,
      Anomalia: r.hasAnomaly ? "Si" : "No",
    }));

    const workbook = XLSX.utils.book_new();
    
    const reportSheet = XLSX.utils.json_to_sheet(reportData);
    XLSX.utils.book_append_sheet(workbook, reportSheet, "Report Operatori");
    
    const detailSheet = XLSX.utils.json_to_sheet(detailData);
    XLSX.utils.book_append_sheet(workbook, detailSheet, "Dettaglio Prestazioni");

    XLSX.writeFile(workbook, `report-compensi-${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Export completato",
      description: "Il file Excel è stato scaricato",
    });
  }, [records, toast]);

  const renderImportContent = () => {
    if (importStep === "mapping") {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setImportStep("upload")} data-testid="button-back-to-upload">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Indietro
            </Button>
            <div>
              <h2 className="text-xl font-semibold">Mappatura Colonne</h2>
              <p className="text-muted-foreground text-sm">
                Associa le colonne del file ai campi dell'applicazione
              </p>
            </div>
          </div>

          <ColumnMapper
            sourceColumns={sourceColumns}
            rawData={rawData}
            savedMappings={mappings}
            onMappingComplete={handleMappingComplete}
            onSaveMapping={handleSaveMapping}
            onDeleteMapping={handleDeleteMapping}
            operatorColors={operatorColors}
            onUpdateOperatorColors={handleUpdateOperatorColors}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 pt-[20px] pb-[20px]">
        <div className="w-full max-w-2xl">
          <FileUpload onDataLoaded={handleDataLoaded} />
        </div>
      </div>
    );
  };

  const renderAnalysisContent = () => {
    if (records.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <FileSpreadsheet className="h-16 w-16 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Nessun dato disponibile</h3>
            <p className="text-muted-foreground">
              Importa un file per visualizzare l'analisi dei compensi
            </p>
          </div>
          <Button onClick={() => setMainTab("import")} data-testid="button-go-to-import">
            <Upload className="mr-2 h-4 w-4" />
            Vai all'importazione
          </Button>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0 w-full">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4">
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {currentDateRange && `Periodo: ${currentDateRange}`}
            </p>
          </div>
        </div>
        {isLoadingRecords ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento dati...</p>
          </div>
        ) : (
          <DataTable
            records={records}
            operators={operators}
            onCategoryChange={handleCategoryChange}
            onRecordEdit={handleRecordEdit}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="flex-1 container py-4 px-4 min-h-0 flex flex-col">
        <Tabs value={mainTab} onValueChange={setMainTab} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
            <TabsList className={`grid px-2 ${userRole === "admin" ? "max-w-2xl grid-cols-5" : "max-w-xl grid-cols-4"} flex-1`}>
              <TabsTrigger value="import" data-testid="main-tab-import" className="h-8 text-xs">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Importazione
              </TabsTrigger>
              <TabsTrigger value="analysis" data-testid="main-tab-analysis" className="h-8 text-xs">
                <Table className="mr-1.5 h-3.5 w-3.5" />
                Analisi
              </TabsTrigger>
              <TabsTrigger value="archive" data-testid="main-tab-archive" className="h-8 text-xs">
                <Archive className="mr-1.5 h-4 w-4" />
                Storico Analisi ({analyses.length})
              </TabsTrigger>
              <TabsTrigger value="operators" data-testid="main-tab-operators" className="h-8 text-xs">
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Operatori
              </TabsTrigger>
              {userRole === "admin" && (
                <TabsTrigger value="users" data-testid="main-tab-users" className="h-8 text-xs">
                  <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
                  Utenti
                </TabsTrigger>
              )}
            </TabsList>

          </div>

          <TabsContent value="import" className="flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
            {renderImportContent()}
          </TabsContent>

          <TabsContent value="analysis" className="flex-1 min-h-0 flex flex-col data-[state=inactive]:hidden">
            <DataTable
              records={records}
              operators={operators}
              onCategoryChange={handleCategoryChange}
              onRecordEdit={handleRecordEdit}
              headerActions={
                <>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-archive-current" className="h-8 text-xs">
                        <FolderArchive className="mr-1.5 h-3.5 w-3.5" />
                        Salva
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archiviare l'analisi corrente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          L'analisi corrente con {records.length} record verrà spostata nell'archivio.
                          I dati saranno rimossi dalla vista corrente ma resteranno accessibili nell'archivio.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveCurrent} data-testid="button-confirm-archive">
                          Archivia
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Sheet open={isReportOpen} onOpenChange={setIsReportOpen}>
                    <SheetTrigger asChild>
                      <Button size="sm" data-testid="button-open-reports" className="h-8 text-xs">
                        <UsersIcon className="mr-1.5 h-3.5 w-3.5" />
                        Report Operatori
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5" />
                          Report Operatori
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <OperatorDashboard
                          records={records}
                          onExportExcel={handleExportExcel}
                          selectedOperator={selectedOperator}
                          onSelectOperator={setSelectedOperator}
                          onUpdateRecord={(id, compensoOperatore) => handleRecordEdit(id, "compensoOperatore", compensoOperatore)}
                          dateRange={currentDateRange}
                          operatorColors={operatorColors}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              }
            />
          </TabsContent>

          <TabsContent value="archive" className="flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
            <AnalysisArchive
              analyses={analyses}
              onDeleteAnalysis={handleDeleteAnalysis}
              onBulkDeleteAnalyses={handleBulkDeleteAnalyses}
              onOpenAnalysis={handleOpenAnalysis}
              isLoading={isLoadingAnalyses}
            />
          </TabsContent>

          <TabsContent value="operators" className="flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
            <OperatorsTab
              analyses={analyses}
              operatorColors={operatorColors}
              onUpdateOperatorColors={handleUpdateOperatorColors}
              managedOperators={managedOperators}
              onRefreshOperators={() => refetchOperators()}
            />
          </TabsContent>

          {userRole === "admin" && (
            <TabsContent value="users" className="flex-1 min-h-0 overflow-y-auto data-[state=inactive]:hidden">
              <UsersTab />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <DuplicateModal
        open={duplicateModalOpen}
        onOpenChange={setDuplicateModalOpen}
        duplicates={duplicates}
        onImportSelected={handleImportWithExclusions}
        totalRecords={rawData.length}
      />
    </div>
  );
}
