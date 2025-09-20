import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/apiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import ZoomableImage from '@/components/ZoomableImage';

const FieldRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between py-2 border-b">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="font-medium">{value ?? '-'}</div>
  </div>
);

export const RecordPage: React.FC = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        // Backend supports GET /medical-records/<id>
        const idNum = Number(patientId);
        const data = await apiService.getMedicalRecord(idNum);
        if (mounted) {
          setRecord(data);
          setForm({
            patient_name: data.patient_name,
            age: data.age,
            sex: data.sex,
            diagnosis: data.diagnosis,
            medications: data.medications,
            blood_pressure: (data as any).blood_pressure ?? (data as any).bloodPressure ?? '',
            weight: (data as any).weight ?? '',
            height: (data as any).height ?? '',
            temperature: (data as any).temperature ?? '',
            patient_id: (data as any).patient_id ?? (data as any).patientId ?? '',
            image_url: data.image_url,
          });
        }
      } catch (err: any) {
        console.error('Failed to load record', err);
        toast({ title: 'Error', description: 'Failed to load patient record', variant: 'destructive' });
        navigate('/');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleSave = async () => {
    if (!record) return;
    // Quick auth check before attempting save
    if (!user) {
      toast({ title: 'Not authenticated', description: 'You must be signed in to update records', variant: 'destructive' });
      return;
    }
    try {
      // Ensure we pass the DB primary key (record.id) to the update endpoint
      const recId = Number((record as any).id);
      const updated = await apiService.updateMedicalRecord(recId, form);
      if (updated) setRecord(updated);
      toast({ title: 'Saved', description: 'Record updated' });
      setEditing(false);
    } catch (err) {
      console.error('Save failed', err);
      // Try to surface server error details if available
      const msg = (err && (err as any).message) ? (err as any).message : 'Failed to save record';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!record) return;
    const ok = window.confirm('Delete this record? This action cannot be undone.');
    if (!ok) return;
    try {
      await apiService.deleteMedicalRecord(Number(record.id));
      toast({ title: 'Deleted', description: 'Record deleted' });
      navigate(-1);
    } catch (err) {
      console.error('Delete failed', err);
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!record) return <div className="p-6">Record not found</div>;

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">Dashboard &gt; Patient Records &gt; {record.patient_id || record.id}</div>
          <h1 className="text-xl sm:text-2xl font-semibold">Patient Record - {record.patient_id || record.id} {record.patient_name ? `(${record.patient_name})` : ''}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
          <Button onClick={() => navigate(-1)} size="sm">Back</Button>
          <Button onClick={() => setEditing(!editing)} size="sm">{editing ? 'Cancel' : 'Edit'}</Button>
          <Button onClick={handleSave} disabled={!editing} size="sm">Save</Button>
          <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white" size="sm">Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Patient Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Patient ID</div>
              {editing ? (
                <Input value={form.patient_id || ''} onChange={e => setForm({...form, patient_id: e.target.value})} />
              ) : (
                <div className="font-medium">{record.patient_id || record.patientId || record.id}</div>
              )}
            </div>

            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Name</div>
              {editing ? (
                <Input value={form.patient_name || ''} onChange={e => setForm({...form, patient_name: e.target.value})} />
              ) : (
                <div className="font-medium">{record.patient_name}</div>
              )}
            </div>

            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Age</div>
              {editing ? (
                <Input type="number" value={form.age ?? ''} onChange={e => setForm({...form, age: e.target.value ? Number(e.target.value) : ''})} />
              ) : (
                <div className="font-medium">{record.age ?? '-'}</div>
              )}
            </div>

            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Sex</div>
              {editing ? (
                <Input value={form.sex || ''} onChange={e => setForm({...form, sex: e.target.value})} />
              ) : (
                <div className="font-medium">{record.sex ?? '-'}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vital Signs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Blood Pressure</div>
              {editing ? (
                <Input value={form.blood_pressure || ''} onChange={e => setForm({...form, blood_pressure: e.target.value})} />
              ) : (
                <div className="font-medium">{record.blood_pressure || '-'}</div>
              )}
            </div>
            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Weight</div>
              {editing ? (
                <Input value={form.weight || ''} onChange={e => setForm({...form, weight: e.target.value})} />
              ) : (
                <div className="font-medium">{record.weight || '-'}</div>
              )}
            </div>
            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Height</div>
              {editing ? (
                <Input value={form.height || ''} onChange={e => setForm({...form, height: e.target.value})} />
              ) : (
                <div className="font-medium">{record.height || '-'}</div>
              )}
            </div>
            <div className="py-2 border-b">
              <div className="text-sm text-muted-foreground">Temperature</div>
              {editing ? (
                <Input value={form.temperature || ''} onChange={e => setForm({...form, temperature: e.target.value})} />
              ) : (
                <div className="font-medium">{record.temperature || '-'}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Image</CardTitle>
          </CardHeader>
          <CardContent>
            {record.image_url ? (
              <div className="w-full">
                <div className="max-h-56 overflow-hidden rounded bg-muted">
                  <ZoomableImage src={record.image_url} alt={`record-${record.id}`} />
                </div>
                <div className="mt-2 text-xs text-muted-foreground break-words">Click image to open in a new tab</div>
              </div>
            ) : (
              <div className="text-muted-foreground">No image</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Diagnosis & Prescription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Diagnosis</div>
                {editing ? (
                  <Textarea value={form.diagnosis || ''} onChange={e => setForm({...form, diagnosis: e.target.value})} />
                ) : (
                  <div className="font-medium break-words whitespace-pre-wrap">{record.diagnosis || '-'}</div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Prescription / Medications</div>
                {editing ? (
                  <Textarea value={form.medications || ''} onChange={e => setForm({...form, medications: e.target.value})} />
                ) : (
                  <div className="font-medium break-words whitespace-pre-wrap">{record.medications || '-'}</div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Full OCR Text</div>
                <pre className="mt-2 p-2 bg-muted rounded text-sm overflow-auto max-h-72 break-words whitespace-pre-wrap">{record.raw_text || 'No extracted text available.'}</pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes & History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Created At</div>
              <div className="font-medium">{record.created_at}</div>
              <div className="text-sm text-muted-foreground mt-2">Additional Notes</div>
              {editing ? (
                <Textarea value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})} />
              ) : (
                <div className="whitespace-pre-wrap break-words max-h-60 overflow-auto">{record.notes || '-'}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 mt-6">
        {/* Export actions: Save current record as PDF, Export all as CSV */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="bg-green-600 text-white">Export</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => {
              // Build a print/PDF-friendly HTML document and open the print dialog so users can 'Save as PDF'
              const safe = (s: any) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const created = record.created_at ? new Date(record.created_at).toLocaleString() : '';
              const rawText = (record.raw_text || '').toString();
              const title = `Patient Record — ${safe(record.patient_id || record.id)}${record.patient_name ? ` — ${safe(record.patient_name)}` : ''}`;
              const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${safe(record.patient_id || record.id)}</title><style>
                @page { size: A4; margin: 20mm }
                html,body{height:100%}
                body{font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial; color:#111827; margin:0; padding:24px; background: #fff}
                .container{max-width:800px;margin:0 auto}
                .header{border-bottom:1px solid #e6e6e6;padding-bottom:12px;margin-bottom:18px}
                h1{font-size:20px;margin:0 0 6px}
                .muted{color:#6b7280;font-size:13px}
                .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
                .card{border:1px solid #eef2f7;padding:12px;border-radius:6px}
                .label{font-weight:700;color:#374151;font-size:13px}
                .value{font-size:14px;margin-top:4px}
                .section{margin-top:14px;page-break-inside:avoid}
                .pre{white-space:pre-wrap;background:#fbfdff;border:1px solid #dfe6ee;padding:12px;border-radius:6px;font-size:13px;line-height:1.5}
                .thumb{display:block;margin:8px auto;width:160px;max-width:100%;height:auto;border:1px solid #e5e7eb;padding:4px;border-radius:6px;object-fit:cover}
                .meta{font-size:12px;color:#374151;margin-top:8px;text-align:center}
                .diag, .meds{font-size:14px;line-height:1.45}
                @media print { body { padding: 10mm } .thumb{width:120px} }
              </style></head><body><div class="container"><div class="header"><h1>${title}</h1><div class="muted">Created: ${safe(created)}</div></div>` +
                // remove interactive buttons; auto-print only
                `` +
                `<div class="info-grid"><div class="card"><div class="label">Patient ID</div><div class="value">${safe(record.patient_id || record.id)}</div><div class="label" style="margin-top:8px">Name</div><div class="value">${safe(record.patient_name || '-')}</div><div class="label" style="margin-top:8px">Age</div><div class="value">${safe(record.age ?? '-')}</div><div class="label" style="margin-top:8px">Sex</div><div class="value">${safe(record.sex ?? '-')}</div></div>` +
                `<div class="card" style="text-align:center">${record.image_url ? `<img id="recordImg" class="thumb" src="${safe(record.image_url)}" alt="record image" style="width:220px;"/>` : '<div class="meta">No image</div>'}${record.image_url ? `<div id="imgMeta" class="meta">${safe(record.image_url.split('/').pop()||'')}</div><div id="imgSize" class="meta" style="font-weight:700;margin-top:6px">Size: loading...</div>` : ''}</div></div>` +
                `<div class="section"><h2 style="margin:0 0 8px">Vital Signs</h2><div style="display:flex;gap:12px"><div style="flex:1"><div class="label">Weight</div><div class="value">${safe(record.weight ?? '-')}</div></div><div style="flex:1"><div class="label">Height</div><div class="value">${safe(record.height ?? '-')}</div></div><div style="flex:1"><div class="label">Temperature</div><div class="value">${safe(record.temperature ?? '-')}</div></div><div style="flex:1"><div class="label">Blood Pressure</div><div class="value">${safe(record.blood_pressure ?? record.bloodPressure ?? '-')}</div></div></div></div>` +
                `<div class="section"><h2 style="margin:0 0 8px">Diagnosis</h2><div class="diag">${(record.diagnosis || '-').toString().replace(/\n/g,'<br/>')}</div></div>` +
                `<div class="section"><h2 style="margin:0 0 8px">Medications</h2><div class="meds">${(record.medications || '-').toString().replace(/\n/g,'<br/>')}</div></div>` +
                `<div class="section"><h2 style="margin:0 0 8px">Raw OCR Text</h2><div class="pre">${safe(rawText)}</div></div>` +
                `</div><script>
                (function(){
                  function init(){
                    try{
                      var img = document.getElementById('recordImg');
                      var imgSizeEl = document.getElementById('imgSize');
                      function updateInfoFromBlobSize(bytes){ if(imgSizeEl){ var dims = img && img.naturalWidth ? (img.naturalWidth + '×' + img.naturalHeight) : ''; imgSizeEl.textContent = 'Size: ' + dims + (bytes ? ' (' + Math.round(bytes/1024) + ' KB)' : ''); } }
                      function updateInfo(){ if(!img) return; if(img.complete && img.naturalWidth){ var src = img.getAttribute('src'); if(!src){ updateInfoFromBlobSize(null); return; } if(src.indexOf('data:')===0){ var size = Math.ceil((src.length - src.indexOf(',') - 1) * 3 / 4); updateInfoFromBlobSize(size); return; } fetch(src, { method: 'HEAD' }).then(function(r){ var cl = r.headers.get('content-length'); if(cl){ updateInfoFromBlobSize(parseInt(cl,10)); return; } return fetch(src).then(function(rr){ return rr.blob(); }).then(function(b){ updateInfoFromBlobSize(b.size); }).catch(function(){ updateInfoFromBlobSize(null); }); }).catch(function(){ fetch(src).then(function(rr){ return rr.blob(); }).then(function(b){ updateInfoFromBlobSize(b.size); }).catch(function(){ updateInfoFromBlobSize(null); }); }); } else { img.addEventListener('load', updateInfo); } }
                      // automatic print flow once content (and image) is ready
                      function tryPrint(){ try{ window.focus(); setTimeout(function(){ try{ window.print(); }catch(e){} }, 300); }catch(e){} }
                      if(img){ if(img.complete && img.naturalWidth){ updateInfo(); tryPrint(); } else { img.addEventListener('load', function(){ updateInfo(); tryPrint(); }); setTimeout(function(){ tryPrint(); }, 1500); } } else { setTimeout(tryPrint, 300); }
                    }catch(e){ /* ignore errors */ }
                  }
                  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
                })();
                </script></body></html>`;

              // Open a new window and write the HTML directly; then call print to allow saving as PDF
              const w = window.open('', '_blank');
              if (!w) {
                toast({ title: 'Popup Blocked', description: 'Please allow popups for this site to export records', variant: 'destructive' });
                return;
              }
              w.document.open();
              w.document.write(html);
              w.document.close();
              // Wait for load to ensure styles/images are ready, then call print
              const tryPrint = () => {
                try {
                  w.focus();
                  // Some browsers need a small delay before printing
                  setTimeout(() => { try { w.print(); } catch (e) { /* ignore */ } }, 300);
                } catch (err) {
                  // ignore printed errors
                }
              };
              // If image exists, wait for it to load before printing
              if (record.image_url) {
                const img = w.document.querySelector('img');
                if (img) {
                  img.addEventListener('load', tryPrint);
                  // fallback if image doesn't fire load
                  setTimeout(tryPrint, 1000);
                } else {
                  setTimeout(tryPrint, 500);
                }
              } else {
                setTimeout(tryPrint, 300);
              }
            }}>Download</DropdownMenuItem>
            <DropdownMenuItem onClick={async () => {
               try {
                 const resp = await apiService.getMedicalRecords();
                 const rows = resp || [];
                 if (!rows || rows.length === 0) {
                   alert('No records to export');
                   return;
                 }
                 // Friendly headers mapping
                 const headerMap: [string,string][] = [
                   ['patient_id', 'Patient ID'],
                   ['patient_name', 'Name'],
                   ['age', 'Age'],
                   ['sex', 'Sex'],
                   ['weight', 'Weight'],
                   ['height', 'Height'],
                   ['temperature', 'Temperature'],
                   ['blood_pressure', 'Blood Pressure'],
                   ['diagnosis', 'Diagnosis'],
                   ['medications', 'Medications'],
                   ['created_at', 'Created At']
                 ];

                 // Build CSV with BOM for Excel and robust escaping, include truncated raw_text
                 const BOM = '\uFEFF';
                 const escape = (v: any) => {
                   if (v === null || v === undefined) return '';
                   const s = String(v);
                   return '"' + s.replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
                 };

                 const headerRow = headerMap.map(h => '"' + h[1].replace(/"/g,'""') + '"').join(',');
                 const lines = [headerRow];
                 for (const r of rows) {
                   const row = headerMap.map(h => {
                     const key = h[0];
                     let val = (r as any)[key];
                     if (key === 'raw_text') val = (val || '').toString().slice(0, 2000); // keep preview length reasonable
                     if (key === 'diagnosis' || key === 'medications') val = (val || '').toString().replace(/\r?\n/g, ' | ');
                     return escape(val);
                   }).join(',');
                   lines.push(row);
                 }

                 const csvContent = BOM + lines.join('\n');
                 const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `medical_records_export_${new Date().toISOString().slice(0,10)}.csv`;
                 document.body.appendChild(a);
                 a.click();
                 a.remove();
                 URL.revokeObjectURL(url);
               } catch (err) {
                 console.error('Export failed', err);
                 alert('Failed to export records');
               }
             }}>Export all records as CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default RecordPage;
