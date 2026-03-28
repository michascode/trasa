import { FormEvent, useEffect, useMemo, useState } from 'react';

type Driver = { id: string; name: string };
type Order = { id: string; label: string };
type WeekOrder = { orderId: string; label: string; status: string };
type Week = {
  id: string;
  weekStartDate: string;
  status: 'draft' | 'archived';
  lockedAt: string | null;
  drivers: Array<{ driverId: string; driverName: string; workDaysCount: number }>;
  orders: WeekOrder[];
};


type OptimizerScenario = {
  id: string;
  name: string;
  description: string;
  precheck: { totalOrders: number; totalUnits: number; totalWorkDays: number };
};

type OptimizationResponse = {
  status: 'FEASIBLE' | 'PARTIAL' | 'INFEASIBLE';
  report: {
    precheck: {
      totalOrders: number;
      totalUnits: number;
      totalWorkDays: number;
      totalVehicleCapacityPerDay: number;
      totalWeeklyCapacity: number;
    };
    conflicts: Array<{ orderId?: string; code: string; reason: string }>;
    unassignedOrderIds: string[];
    objectiveBreakdown: { totalKm: number; totalDurationMin: number; totalFuelCost: number; score: number };
    notes: string[];
  };
};

type WeekDetails = Week & {
  availableDrivers: Driver[];
  availableOrders: Order[];
  previousWeekId: string | null;
  orderStatusCounts: Record<string, number>;
};

export function PlanningPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [weekDetails, setWeekDetails] = useState<WeekDetails | null>(null);
  const [weekStartDate, setWeekStartDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [workDays, setWorkDays] = useState(5);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [transferOrders, setTransferOrders] = useState<string[]>([]);
  const [optimizerScenarios, setOptimizerScenarios] = useState<OptimizerScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResponse | null>(null);

  async function loadWeeks(preferredWeekId?: string) {
    const response = await fetch('/api/planning/weeks');
    const data: Week[] = await response.json();
    setWeeks(data);
    const effectiveWeekId = preferredWeekId ?? data[0]?.id;
    if (effectiveWeekId) {
      setSelectedWeekId(effectiveWeekId);
      await loadWeekDetails(effectiveWeekId);
    }
  }

  async function loadWeekDetails(weekId: string) {
    const response = await fetch(`/api/planning/weeks/${weekId}`);
    const details: WeekDetails = await response.json();
    setWeekDetails(details);
    setSelectedDriverId(details.availableDrivers[0]?.id ?? '');
    setSelectedOrders(details.orders.map((order) => order.orderId));
  }

  async function loadOptimizerScenarios() {
    const response = await fetch('/api/optimizer/scenarios');
    const scenarios: OptimizerScenario[] = await response.json();
    setOptimizerScenarios(scenarios);
    setSelectedScenarioId(scenarios[0]?.id ?? '');
  }

  useEffect(() => {
    void loadWeeks();
    void loadOptimizerScenarios();
  }, []);

  const previousWeekOrders = useMemo(() => {
    if (!weekDetails?.previousWeekId) return [];
    const previousWeek = weeks.find((week) => week.id === weekDetails.previousWeekId);
    return previousWeek?.orders ?? [];
  }, [weekDetails, weeks]);

  async function handleCreateWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/planning/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStartDate }),
    });
    const created: Week = await response.json();
    await loadWeeks(created.id);
  }

  async function assignDriver() {
    if (!weekDetails || !selectedDriverId) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: selectedDriverId, workDaysCount: workDays }),
    });
    await loadWeeks(weekDetails.id);
  }

  async function updateWorkDays(driverId: string, days: number) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers/${driverId}/work-days`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workDaysCount: days }),
    });
    await loadWeekDetails(weekDetails.id);
  }

  async function unassignDriver(driverId: string) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers/${driverId}`, { method: 'DELETE' });
    await loadWeeks(weekDetails.id);
  }

  async function saveOrderSelection() {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: selectedOrders }),
    });
    await loadWeeks(weekDetails.id);
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadWeekDetails(weekDetails.id);
  }

  async function moveOrdersFromPreviousWeek() {
    if (!weekDetails || transferOrders.length === 0) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: transferOrders }),
    });
    setTransferOrders([]);
    await loadWeeks(weekDetails.id);
  }


  async function runOptimizerScenario() {
    if (!selectedScenarioId) return;
    const scenarioResponse = await fetch(`/api/optimizer/scenarios/${selectedScenarioId}`);
    const scenario = await scenarioResponse.json();

    const response = await fetch('/api/optimizer/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario.input),
    });

    const result: OptimizationResponse = await response.json();
    setOptimizationResult(result);
  }

  async function archiveWeek() {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/archive`, { method: 'POST' });
    await loadWeeks(weekDetails.id);
  }

  return (
    <section>
      <h1>Planowanie tygodniowe</h1>

      <form className="planning-create-form" onSubmit={handleCreateWeek}>
        <label>
          Data tygodnia
          <input type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} required />
        </label>
        <button type="submit">Utwórz tydzień</button>
      </form>

      <div className="planning-grid">

      <article className="optimizer-panel">
        <h2>Silnik układania tras (VRP)</h2>
        <p>Przed uruchomieniem optymalizacji widzisz sumę ilości towarów i dni pracy kierowców.</p>
        <div className="inline-controls">
          <select value={selectedScenarioId} onChange={(event) => setSelectedScenarioId(event.target.value)}>
            {optimizerScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void runOptimizerScenario()} disabled={!selectedScenarioId}>
            Uruchom optymalizację
          </button>
        </div>

        {selectedScenarioId && (
          <div>
            {optimizerScenarios
              .filter((scenario) => scenario.id === selectedScenarioId)
              .map((scenario) => (
                <p key={scenario.id}>
                  Wejście: zamówienia {scenario.precheck.totalOrders}, ładunek {scenario.precheck.totalUnits} j., dni pracy {scenario.precheck.totalWorkDays}.
                </p>
              ))}
          </div>
        )}

        {optimizationResult && (
          <div className="optimizer-report">
            <h3>Raport optymalizacji: {optimizationResult.status}</h3>
            <p>
              Suma wejścia: {optimizationResult.report.precheck.totalOrders} zamówień, {optimizationResult.report.precheck.totalUnits} jednostek,
              tygodniowa pojemność {optimizationResult.report.precheck.totalWeeklyCapacity}.
            </p>
            <p>
              Cel: {optimizationResult.report.objectiveBreakdown.totalKm} km, {optimizationResult.report.objectiveBreakdown.totalDurationMin} min,
              koszt paliwa {optimizationResult.report.objectiveBreakdown.totalFuelCost} PLN, score {optimizationResult.report.objectiveBreakdown.score}.
            </p>
            <p>Niezaplanowane zamówienia: {optimizationResult.report.unassignedOrderIds.join(', ') || 'brak'}.</p>
            <ul>
              {optimizationResult.report.conflicts.map((conflict, idx) => (
                <li key={`${conflict.code}-${idx}`}>
                  [{conflict.code}] {conflict.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>
        <article>
          <h2>Lista tygodni</h2>
          <ul className="week-list">
            {weeks.map((week) => (
              <li key={week.id}>
                <button type="button" className={selectedWeekId === week.id ? 'active-week' : ''} onClick={() => void loadWeekDetails(week.id)}>
                  {week.weekStartDate} ({week.status})
                </button>
              </li>
            ))}
          </ul>
        </article>

        {weekDetails && (
          <article>
            <h2>Widok tygodnia: {weekDetails.weekStartDate}</h2>
            <p>Status tygodnia: <strong>{weekDetails.status}</strong></p>

            <h3>Przypisanie kierowców</h3>
            <div className="inline-controls">
              <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)}>
                {weekDetails.availableDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
              <input type="number" min={1} max={7} value={workDays} onChange={(event) => setWorkDays(Number(event.target.value))} />
              <button type="button" onClick={() => void assignDriver()}>Przypisz</button>
            </div>
            <ul>
              {weekDetails.drivers.map((driver) => (
                <li key={driver.driverId}>
                  {driver.driverName} — dni pracy: {driver.workDaysCount}
                  <button type="button" onClick={() => void updateWorkDays(driver.driverId, Math.min(7, driver.workDaysCount + 1))}>+1 dzień</button>
                  <button type="button" onClick={() => void unassignDriver(driver.driverId)}>Odepnij</button>
                </li>
              ))}
            </ul>

            <h3>Wybór zamówień do planowania</h3>
            <div className="order-box">
              {weekDetails.availableOrders.map((order) => (
                <label key={order.id}>
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.id)}
                    onChange={(event) => {
                      setSelectedOrders((current) =>
                        event.target.checked ? [...current, order.id] : current.filter((item) => item !== order.id),
                      );
                    }}
                  />
                  {order.label}
                </label>
              ))}
            </div>
            <button type="button" onClick={() => void saveOrderSelection()}>Zapisz wybór zamówień</button>

            <h3>Statusy zamówień</h3>
            <p>
              nieprzypisane: {weekDetails.orderStatusCounts.unassigned} | zaplanowane: {weekDetails.orderStatusCounts.planned} |
              konfliktowe: {weekDetails.orderStatusCounts.conflict} | przeniesione: {weekDetails.orderStatusCounts.moved} |
              pominięte: {weekDetails.orderStatusCounts.skipped}
            </p>
            <ul>
              {weekDetails.orders.map((order) => (
                <li key={order.orderId}>
                  {order.label} — <strong>{order.status}</strong>
                  <select value={order.status} onChange={(event) => void updateOrderStatus(order.orderId, event.target.value)}>
                    <option value="unassigned">nieprzypisane</option>
                    <option value="planned">zaplanowane</option>
                    <option value="conflict">konfliktowe</option>
                    <option value="moved">przeniesione</option>
                    <option value="skipped">pominięte</option>
                  </select>
                </li>
              ))}
            </ul>

            <h3>Przenoszenie zamówień z poprzedniego tygodnia</h3>
            {weekDetails.previousWeekId ? (
              <>
                <div className="order-box">
                  {previousWeekOrders.map((order) => (
                    <label key={order.orderId}>
                      <input
                        type="checkbox"
                        checked={transferOrders.includes(order.orderId)}
                        onChange={(event) => {
                          setTransferOrders((current) =>
                            event.target.checked ? [...current, order.orderId] : current.filter((item) => item !== order.orderId),
                          );
                        }}
                      />
                      {order.label} ({order.status})
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => void moveOrdersFromPreviousWeek()}>Przenieś do bieżącego tygodnia</button>
              </>
            ) : (
              <p>Brak poprzedniego tygodnia.</p>
            )}

            <h3>Archiwum</h3>
            <button type="button" onClick={() => void archiveWeek()} disabled={weekDetails.status === 'archived'}>
              Zatwierdź i zablokuj tydzień
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
