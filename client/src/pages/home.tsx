import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapper } from "@/components/column-mapper";
import { DataTable } from "@/components/data-table";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { AnalysisArchive } from "@/components/analysis-archive";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Table, BarChart3, Upload, Archive, FileSpreadsheet, Users, FolderArchive } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import type { CompensoRecord, ColumnMapping, Analysis, CategoriaCompenso } from "@shared/schema";

type ImportStep = "upload" | "mapping";

export default function Home() {
  const [mainTab, setMainTab] = useState<string>("import");
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState<string>("");
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: records = [], isLoading: isLoadingRecords } = useQuery<CompensoRecord[]>({
    queryKey: ["/api/records"],
  });

  const { data: mappings = [] } = useQuery<ColumnMapping[]>({
    queryKey: ["/api/mappings"],
  });

  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
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
      return apiRequest("PATCH", "/api/records/bulk/update", { ids, updates: { categoriaCompenso: category } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
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

  const handleMappingComplete = useCallback((fieldMappings: Record<string, string>) => {
    importMutation.mutate({
      records: rawData,
      mappings: fieldMappings,
    });
  }, [rawData, importMutation]);

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
        "Compenso Carta": roundToTen(compensoCard),
        "Compenso Contanti": roundToTen(compensoCash),
        "Anomalie": numeroAnomalie,
      };
    });

    const detailData = records.map((r) => ({
      "Categoria": r.categoriaCompenso === "card" ? "Carta" : "Contanti",
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
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12">
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
      <div className="space-y-6 pl-[16px] pr-[16px]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-muted-foreground pl-[16px] pr-[16px]">
              {records.length} record {currentDateRange && `| Periodo: ${currentDateRange}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" data-testid="button-archive-current">
                  <FolderArchive className="mr-2 h-4 w-4" />
                  Archivia Analisi
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
                <Button data-testid="button-open-reports">
                  <Users className="mr-2 h-4 w-4" />
                  Report Operatori
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
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
                />
              </div>
            </SheetContent>
            </Sheet>
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 pl-[16px] pr-[16px]">
          <h1 className="text-2xl font-bold tracking-tight">Gestione Compensi</h1>
        </div>
      </header>
      <div className="container py-6">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3 px-4">
            <TabsTrigger value="import" data-testid="main-tab-import">
              <Upload className="mr-2 h-4 w-4" />
              Importazione
            </TabsTrigger>
            <TabsTrigger value="analysis" data-testid="main-tab-analysis">
              <Table className="mr-2 h-4 w-4" />
              Analisi
            </TabsTrigger>
            <TabsTrigger value="archive" data-testid="main-tab-archive">
              <Archive className="mr-2 h-4 w-4" />
              Archivio ({analyses.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import" className="mt-6">
            {renderImportContent()}
          </TabsContent>

          <TabsContent value="analysis" className="mt-6">
            {renderAnalysisContent()}
          </TabsContent>

          <TabsContent value="archive" className="mt-6">
            <AnalysisArchive
              analyses={analyses}
              onDeleteAnalysis={handleDeleteAnalysis}
              onBulkDeleteAnalyses={handleBulkDeleteAnalyses}
              isLoading={isLoadingAnalyses}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
