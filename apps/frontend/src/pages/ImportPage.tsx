import { FormEvent, useMemo, useState } from 'react';

type ImportIssue = { code: string; severity: 'warning' | 'error'; message: string };
type OrderItem = { canonicalBreedKey: string; units: number };
type RowPreview = {
  id: string;
  rowNumber: number;
  parseStatus: string;
  rawOrderText: string;
  parseErrorsJson: ImportIssue[] | null;
  normalizedOrder: {
    id: string;
    addressLine: string | null;
    phone: string | null;
    notes: string | null;
    orderedGoodsText: string | null;
    numberingText: string | null;
    orderItems: OrderItem[];
  } | null;
};

type BatchPreview = {
  id: string;
  status: string;
  sourceFilename: string;
  rawRows: RowPreview[];
};

type ParserMetadata = {
  supportedPatterns: string[];
  aliases: Array<{ alias: string; canonicalBreedKey: string }>;
};

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<BatchPreview | null>(null);
  const [metadata, setMetadata] = useState<ParserMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const editingRow = useMemo(
    () => batch?.rawRows.find((row) => row.id === editingRowId) ?? null,
    [batch, editingRowId]
  );

  async function loadMetadata() {
    const response = await fetch('/api/import/orders/parser-metadata');
    if (response.ok) {
      setMetadata((await response.json()) as ParserMetadata);
    }
  }

  async function onImportSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fileBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(fileBuffer);
      const chunkSize = 0x8000;
      let binary = '';
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      const response = await fetch('/api/import/orders/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileBase64: btoa(binary) }),
      });
      if (!response.ok) {
        throw new Error('Import nie powiódł się.');
      }
      const payload = (await response.json()) as { batch: BatchPreview };
      setBatch(payload.batch);
      await loadMetadata();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Nieznany błąd importu.');
    } finally {
      setLoading(false);
    }
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingRow?.normalizedOrder) {
      return;
    }
    const form = new FormData(event.currentTarget);
    const payload = {
      addressLine: String(form.get('addressLine') ?? ''),
      phone: String(form.get('phone') ?? ''),
      notes: String(form.get('notes') ?? ''),
      orderedGoodsText: String(form.get('orderedGoodsText') ?? ''),
      numberingText: String(form.get('numberingText') ?? ''),
      correctionNotes: String(form.get('correctionNotes') ?? ''),
    };
    const response = await fetch(`/api/import/orders/rows/${editingRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok || !batch) {
      setError('Nie udało się zapisać korekty.');
      return;
    }
    const refreshed = await fetch(`/api/import/orders/batches/${batch.id}`);
    if (refreshed.ok) {
      setBatch((await refreshed.json()) as BatchPreview);
      setEditingRowId(null);
    }
  }

  return (
    <section>
      <h1>Import zamówień (Excel)</h1>
      <form onSubmit={onImportSubmit} className="import-form">
        <input type="file" accept=".xlsx,.xls" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button type="submit" disabled={!file || loading}>{loading ? 'Importowanie...' : 'Importuj plik'}</button>
      </form>
      {error ? <p className="error">{error}</p> : null}

      {batch ? (
        <>
          <h2>Podgląd batcha: {batch.sourceFilename}</h2>
          <p>Status batcha: <strong>{batch.status}</strong></p>
          <a href={`/api/import/orders/batches/${batch.id}/export`}>Eksportuj do Excela (CSV kompatybilny)</a>
          <table className="import-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Surowy wpis</th>
                <th>Status</th>
                <th>Adres</th>
                <th>Telefon</th>
                <th>Towary</th>
                <th>Błędy / ostrzeżenia</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {batch.rawRows.map((row) => (
                <tr key={row.id}>
                  <td>{row.rowNumber}</td>
                  <td>{row.rawOrderText}</td>
                  <td>{row.parseStatus}</td>
                  <td>{row.normalizedOrder?.addressLine ?? '-'}</td>
                  <td>{row.normalizedOrder?.phone ?? '-'}</td>
                  <td>{row.normalizedOrder?.orderItems.map((item) => `${item.canonicalBreedKey}:${item.units}`).join(', ')}</td>
                  <td>{row.parseErrorsJson?.map((issue) => issue.message).join(' | ') ?? 'brak'}</td>
                  <td><button type="button" onClick={() => setEditingRowId(row.id)}>Popraw</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {editingRow?.normalizedOrder ? (
        <form className="import-form correction-form" onSubmit={submitCorrection}>
          <h3>Ręczna poprawa wiersza #{editingRow.rowNumber}</h3>
          <label>Adres <input name="addressLine" defaultValue={editingRow.normalizedOrder.addressLine ?? ''} /></label>
          <label>Telefon <input name="phone" defaultValue={editingRow.normalizedOrder.phone ?? ''} /></label>
          <label>Uwagi <input name="notes" defaultValue={editingRow.normalizedOrder.notes ?? ''} /></label>
          <label>Zamówione towary <input name="orderedGoodsText" defaultValue={editingRow.normalizedOrder.orderedGoodsText ?? ''} /></label>
          <label>Do numerowania <input name="numberingText" defaultValue={editingRow.normalizedOrder.numberingText ?? ''} /></label>
          <label>Notatka korekty <input name="correctionNotes" /></label>
          <button type="submit">Zapisz korektę</button>
        </form>
      ) : null}

      {metadata ? (
        <div className="meta-grid">
          <div>
            <h3>Wspierane wzorce parsera</h3>
            <ul>{metadata.supportedPatterns.map((pattern) => <li key={pattern}>{pattern}</li>)}</ul>
          </div>
          <div>
            <h3>Aliasy</h3>
            <ul>{metadata.aliases.map((alias) => <li key={alias.alias}>{alias.alias} → {alias.canonicalBreedKey}</li>)}</ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
