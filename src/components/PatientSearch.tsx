import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiService } from '@/services/apiService';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin as _isAdmin } from '@/hooks/roleUtils';
import { useRecords } from '@/context/RecordsContext';
import { Search, Filter, CalendarIcon, Download, Eye } from 'lucide-react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { format } from 'date-fns';

interface MedicalRecord {
  id: string | number;
  patient_name: string;
  patient_id?: string;
  doctor_name?: string;
  age?: number;
  sex?: string;
  date?: string;
  date_recorded?: string;
  diagnosis?: string;
  medications?: string;
  raw_text?: string;
  _raw?: any;
  created_at?: string;
}

export const PatientSearch = ({ records: initialRecords, initialSearchTerm }: { records?: MedicalRecord[]; initialSearchTerm?: string }) => {
  const { user } = useAuth();
  const { records, fetchRecords, loading, searchRecords } = useRecords();
  const [filteredRecords, setFilteredRecords] = useState<MedicalRecord[]>(records || []);
  const [localSearch, setLocalSearch] = useState(initialSearchTerm || '');
  const [diagnosisFilter, setDiagnosisFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [hasSearched, setHasSearched] = useState(false);

  // Do not fetch all records on mount; only fetch when user performs a search.
  // This keeps the Search Results area empty until a search is made.

  // Debounce localSearch and trigger server-backed search. Keep results empty until user types.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!localSearch) {
        // Clear results and mark as not searched
        setHasSearched(false);
        setFilteredRecords([]);
      } else {
        setHasSearched(true);
        searchRecords(localSearch).catch(err => console.error('searchRecords failed', err));
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, localSearch, diagnosisFilter, genderFilter, ageRange, dateRange]);

  const applyFilters = () => {
    // If user hasn't searched yet and no filters are applied, keep results empty
    const anyFilterActive = Boolean(localSearch) || Boolean(diagnosisFilter) || Boolean(genderFilter) || Boolean(ageRange) || Boolean(dateRange.from) || Boolean(dateRange.to);
    if (!hasSearched && !anyFilterActive) {
      setFilteredRecords([]);
      return;
    }

    let filtered = Array.isArray(records) ? [...records] : [];

    if (localSearch) {
      const term = localSearch.toLowerCase();
      filtered = filtered.filter(r => {
        const patientName = (r.patient_name || '').toString().toLowerCase();
        const patientId = (r.patient_id || r.patientId || '').toString().toLowerCase();
        const doctor = (r.doctor_name || r.doctorName || '').toString().toLowerCase();
        const diag = (r.diagnosis || '').toString().toLowerCase();
        const meds = (r.medications || r.raw_text || r.raw || '').toString().toLowerCase();
        return (
          patientName.includes(term) ||
          patientId.includes(term) ||
          doctor.includes(term) ||
          diag.includes(term) ||
          meds.includes(term)
        );
      });
    }

    if (diagnosisFilter) {
      filtered = filtered.filter(r => r.diagnosis?.toLowerCase().includes(diagnosisFilter.toLowerCase()));
    }

    if (genderFilter) {
      filtered = filtered.filter(r => r.sex === genderFilter);
    }

    if (ageRange) {
      filtered = filtered.filter(r => {
        if (!r.age) return false;
        const age = r.age;
        switch (ageRange) {
          case '0-18': return age <= 18;
          case '19-35': return age >= 19 && age <= 35;
          case '36-50': return age >= 36 && age <= 50;
          case '51-65': return age >= 51 && age <= 65;
          case '65+': return age > 65;
          default: return true;
        }
      });
    }

    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(r => {
        const recordDate = new Date(r.date_recorded || r.date || r.created_at || r.createdAt || r._raw?.created_at || r._raw?.timestamp || r.created_at);
        if (!recordDate || Number.isNaN(recordDate.getTime())) return false;
        if (dateRange.from && recordDate < dateRange.from) return false;
        if (dateRange.to && recordDate > dateRange.to) return false;
        return true;
      });
    }

    setFilteredRecords(filtered);
  };

  const resetFilters = () => {
    setLocalSearch('');
    setDiagnosisFilter('');
    setGenderFilter('');
    setAgeRange('');
    setDateRange({});
  };

  const exportResults = () => {
    const csvContent = [
      ['Patient Name', 'Age', 'Gender', 'Date', 'Diagnosis', 'Prescription'],
      ...filteredRecords.map(r => [
        r.patient_name,
        r.age || '',
        r.sex || '',
        (r.date_recorded ? r.date_recorded : (r.date ? format(new Date(r.date), 'yyyy-MM-dd') : (r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd') : ''))),
        r.diagnosis || '',
        r.medications || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient_records_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Do not short-circuit rendering on loading; show spinner only within the results area

  const navigate = useNavigate();
  const uniqueDiagnoses = Array.from(new Set(records.map(r => r.diagnosis).filter(Boolean) as string[])).slice(0, 10);

  // compute active filters robustly (ignore sentinel '__all__' and whitespace)
  const activeFiltersCount = (
    [
      localSearch?.trim(),
      diagnosisFilter && diagnosisFilter !== '__all__' ? diagnosisFilter : '',
      genderFilter && genderFilter !== '__all__' ? genderFilter : '',
      ageRange && ageRange !== '__all__' ? ageRange : ''
    ].filter(Boolean).length + (dateRange.from || dateRange.to ? 1 : 0)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Advanced Patient Search
            </CardTitle>
            <div>
              <Button variant="ghost" onClick={() => { try { navigate(-1); } catch { window.location.href = '/'; } }} aria-label="Go back">Back</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground pointer-events-none">
                  <Search className="h-4 w-4" />
                </div>
                <Input
                  className="pl-3 md:pl-12 w-full"
                placeholder="Search patients, diagnoses, prescriptions..."
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={resetFilters} className="w-full sm:w-auto">Clear Filters</Button>
              <Button onClick={exportResults} disabled={filteredRecords.length === 0} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select value={diagnosisFilter} onValueChange={v => setDiagnosisFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by diagnosis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Diagnoses</SelectItem>
                {uniqueDiagnoses.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={genderFilter} onValueChange={v => setGenderFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filter by gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ageRange} onValueChange={v => setAgeRange(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Filter by age" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Ages</SelectItem>
                <SelectItem value="0-18">0-18 years</SelectItem>
                <SelectItem value="19-35">19-35 years</SelectItem>
                <SelectItem value="36-50">36-50 years</SelectItem>
                <SelectItem value="51-65">51-65 years</SelectItem>
                <SelectItem value="65+">65+ years</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start w-full">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? `${format(dateRange.from, 'MM/dd')} - ${format(dateRange.to, 'MM/dd')}` :
                    format(dateRange.from, 'MM/dd/yyyy')
                  ) : 'Date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange.from || dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined}
                  onSelect={range => setDateRange(range || {})}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {filteredRecords.length} of {records.length} records
            </p>
            <Badge variant="outline">
              <Filter className="mr-1 h-3 w-3" />
              {activeFiltersCount} filters active
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            {loading && hasSearched ? (
              <div className="p-6 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : !hasSearched ? (
              <div className="p-6 text-center text-muted-foreground">Start typing a search term to see results</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No records found matching your criteria</div>
            ) : (
              <>
                {/* Mobile: stacked cards */}
                <div className="md:hidden space-y-3">
                  {filteredRecords.map(r => (
                    <Card key={r.id}>
                      <CardContent className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate">{r.patient_name}</div>
                            <div className="text-sm text-muted-foreground">{r.date_recorded ? format(new Date(r.date_recorded), 'MM/dd/yyyy') : (r.created_at ? format(new Date(r.created_at), 'MM/dd/yyyy') : '-')}</div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                            <div className="text-xs text-muted-foreground">Age: {r.age ?? '-'}</div>
                            <div>{r.sex ? <Badge variant="outline">{r.sex}</Badge> : <span className="text-xs text-muted-foreground">-</span>}</div>
                            <div className="max-w-full truncate text-xs">{r.diagnosis || '-'}</div>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-start">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/record/${r.id}`)} aria-label={`View ${r.patient_name}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Desktop/table for md+ */}
                <div className="hidden md:block w-full">
                  <Table noWrapperOverflow className="w-full table-fixed">
                    <colgroup>
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '6%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '26%' }} />
                      <col style={{ width: '4%' }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: '40%' }} className="!p-2">Patient Name</TableHead>
                        <TableHead style={{ width: '6%' }} className="!p-2 text-center">Age</TableHead>
                        <TableHead style={{ width: '8%' }} className="!p-2">Gender</TableHead>
                        <TableHead style={{ width: '16%' }} className="!p-2">Date</TableHead>
                        <TableHead style={{ width: '26%' }} className="!p-2">Diagnosis</TableHead>
                        <TableHead style={{ width: '4%' }} className="!p-2"><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="!p-2 font-medium truncate text-left">{r.patient_name}</TableCell>
                          <TableCell className="!p-2 text-center align-middle">{r.age || '-'}</TableCell>
                          <TableCell className="!p-2 text-center align-middle">{r.sex ? <Badge variant="outline">{r.sex}</Badge> : '-'}</TableCell>
                          <TableCell className="!p-2 text-center align-middle">{r.date_recorded ? format(new Date(r.date_recorded), 'MM/dd/yyyy') : (r.created_at ? format(new Date(r.created_at), 'MM/dd/yyyy') : '-')}</TableCell>
                          <TableCell className="!p-2 truncate text-left">{r.diagnosis || '-'}</TableCell>
                          <TableCell className="!p-2 text-center align-middle">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/record/${r.id}`)} className="p-1 max-w-[3rem]">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
