import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface FileUploadProps {
  onDataLoaded: (data: Record<string, string>[], columns: string[]) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsLoading(false);
        if (results.errors.length > 0) {
          setError(`Errore nel parsing del CSV: ${results.errors[0].message}`);
          return;
        }
        const data = results.data as Record<string, string>[];
        const columns = results.meta.fields || [];
        if (data.length === 0) {
          setError("Il file non contiene dati");
          return;
        }
        setFileName(file.name);
        setError(null);
        onDataLoaded(data, columns);
      },
      error: (err) => {
        setIsLoading(false);
        setError(`Errore nella lettura del file: ${err.message}`);
      },
    });
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
          raw: false,
          defval: "",
        });
        
        if (jsonData.length === 0) {
          setError("Il file non contiene dati");
          setIsLoading(false);
          return;
        }

        const columns = Object.keys(jsonData[0]);
        setFileName(file.name);
        setError(null);
        setIsLoading(false);
        onDataLoaded(jsonData, columns);
      } catch (err) {
        setIsLoading(false);
        setError("Errore nella lettura del file Excel");
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      setError("Errore nella lettura del file");
    };
    reader.readAsArrayBuffer(file);
  };

  const processFile = useCallback((file: File) => {
    setIsLoading(true);
    setError(null);

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "csv") {
      parseCSV(file);
    } else if (extension === "xlsx" || extension === "xls") {
      parseExcel(file);
    } else {
      setIsLoading(false);
      setError("Formato file non supportato. Usa file CSV o Excel (.xlsx, .xls)");
    }
  }, [onDataLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleReset = () => {
    setFileName(null);
    setError(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          Importa File
        </CardTitle>
        <CardDescription>
          Carica un file CSV o Excel con i dati dei compensi
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {fileName ? (
          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">File caricato con successo</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              data-testid="button-reset-file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-testid="dropzone-file-upload"
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
              data-testid="input-file-upload"
            />
            
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
              </div>
            ) : (
              <>
                <Upload className="mb-4 h-12 w-12 text-muted-foreground/60" />
                <p className="mb-1 text-center font-medium">
                  Trascina il file qui o clicca per selezionarlo
                </p>
                <p className="text-center text-sm text-muted-foreground">
                  Formati supportati: CSV, Excel (.xlsx, .xls)
                </p>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
