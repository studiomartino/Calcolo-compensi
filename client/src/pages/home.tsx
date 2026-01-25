import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUpload } from "@/components/file-upload";
import { ColumnMapper } from "@/components/column-mapper";
import { DataTable } from "@/components/data-table";
import { OperatorDashboard } from "@/components/operator-dashboard";
import { AnalysisArchive } from "@/components/analysis-archive";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Table, BarChart3, Upload, Archive } from "lucide-react";
import * as XLSX from "xlsx";
import type { CompensoRecord, ColumnMapping, Analysis, CategoriaCompenso } from "@shared/schema";

type AppStep = "upload" | "mapping" | "data";

export default function Home() {
  const [step, setStep] = useState<AppStep>("upload");
  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [currentDateRange, setCurrentDateRange] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("table");
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);
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
      setStep("data");
      setActiveTab("table");
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

  const operators = useMemo(() => {
    const uniqueOperators = new Set(records.map((r) => r.operatore));
    return Array.from(uniqueOperators).sort();
  }, [records]);

  const handleDataLoaded = useCallback((data: Record<string, string>[], columns: string[]) => {
    setRawData(data);
    setSourceColumns(columns);
    setStep("mapping");
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

  const handleNewImport = () => {
    setStep("upload");
    setRawData([]);
    setSourceColumns([]);
  };

  if (step === "upload") {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Gestione Compensi</h1>
            <p className="text-muted-foreground text-lg">
              Importa i dati e genera report per i tuoi collaboratori
            </p>
          </div>

          <FileUpload onDataLoaded={handleDataLoaded} />

          {isLoadingRecords ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : records.length > 0 ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Hai già {records.length} record importati
              </p>
              <Button
                variant="outline"
                onClick={() => setStep("data")}
                data-testid="button-view-existing-data"
              >
                Visualizza dati esistenti
              </Button>
            </div>
          ) : null}

          {analyses.length > 0 && (
            <AnalysisArchive
              analyses={analyses}
              onDeleteAnalysis={handleDeleteAnalysis}
              isLoading={isLoadingAnalyses}
            />
          )}
        </div>
      </div>
    );
  }

  if (step === "mapping") {
    return (
      <div className="container max-w-5xl py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setStep("upload")} data-testid="button-back-to-upload">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Indietro
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mappatura Colonne</h1>
            <p className="text-muted-foreground">
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
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestione Compensi</h1>
          <p className="text-muted-foreground">
            {records.length} record importati {currentDateRange && `| Periodo: ${currentDateRange}`}
          </p>
        </div>
        <Button variant="outline" onClick={handleNewImport} data-testid="button-new-import">
          <Upload className="mr-2 h-4 w-4" />
          Nuova Importazione
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="table" data-testid="tab-table">
            <Table className="mr-2 h-4 w-4" />
            Tabella Dati
          </TabsTrigger>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="archive" data-testid="tab-archive">
            <Archive className="mr-2 h-4 w-4" />
            Archivio ({analyses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-6">
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
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          {isLoadingRecords ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Caricamento dashboard...</p>
            </div>
          ) : (
            <OperatorDashboard
              records={records}
              onExportExcel={handleExportExcel}
              selectedOperator={selectedOperator}
              onSelectOperator={setSelectedOperator}
            />
          )}
        </TabsContent>

        <TabsContent value="archive" className="mt-6">
          <AnalysisArchive
            analyses={analyses}
            onDeleteAnalysis={handleDeleteAnalysis}
            isLoading={isLoadingAnalyses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
