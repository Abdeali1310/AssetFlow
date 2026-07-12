"use client";

import React, { useState, useEffect } from "react";
import {
  getAssetUtilization,
  getMaintenanceFrequency,
  getUpcomingMaintenanceAndRetirement,
  getDepartmentAllocationSummary,
  getBookingHeatmap,
} from "@/lib/actions/reports";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  BarChart3,
  Download,
  Calendar,
  AlertTriangle,
  Building2,
  Clock,
  Wrench,
  Loader2,
} from "lucide-react";

export function ReportsClient() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [loading, setLoading] = useState(true);

  // Data states
  const [utilization, setUtilization] = useState<{ mostUsed: any[]; idle: any[] }>({ mostUsed: [], idle: [] });
  const [maintenanceFreq, setMaintenanceFreq] = useState<{ byCategory: any[]; topAssets: any[] }>({ byCategory: [], topAssets: [] });
  const [retirement, setRetirement] = useState<{ openMaintenance: any[]; nearingRetirement: any[] }>({ openMaintenance: [], nearingRetirement: [] });
  const [allocations, setAllocations] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any[]>([]);

  useEffect(() => {
    // Initial fetch
    const now = new Date();
    const ago = new Date();
    ago.setDate(now.getDate() - 90);
    
    setDateFrom(ago.toISOString().split("T")[0]);
    setDateTo(now.toISOString().split("T")[0]);
  }, []);

  const loadData = async () => {
    if (!dateFrom || !dateTo) return;
    
    setLoading(true);
    try {
      const [uRes, mRes, rRes, aRes, hRes] = await Promise.all([
        getAssetUtilization(),
        getMaintenanceFrequency(dateFrom, dateTo),
        getUpcomingMaintenanceAndRetirement(),
        getDepartmentAllocationSummary(),
        getBookingHeatmap(dateFrom, dateTo),
      ]);

      if (uRes.data) setUtilization(uRes.data);
      if (mRes.data) setMaintenanceFreq(mRes.data);
      if (rRes.data) setRetirement(rRes.data);
      if (aRes.data) setAllocations(aRes.data);
      if (hRes.data) setHeatmap(hRes.data);

    } catch (err) {
      toast.error("Failed to load report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadData();
    }
  }, [dateFrom, dateTo]);

  const handleExportCSV = (filename: string, rows: any[]) => {
    if (rows.length === 0) {
      toast.error("No data to export.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [];
    csvRows.push(headers.join(","));

    for (const row of rows) {
      const values = headers.map(header => {
        const val = row[header];
        if (typeof val === "string") {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvRows.push(values.join(","));
    }

    const csvStr = csvRows.join("\n");
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && heatmap.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
        <p className="text-sm font-semibold">Generating Reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Global Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Key insights on asset utilization, maintenance, and allocations.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg">
          <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
          <Input 
            type="date" 
            value={dateFrom} 
            onChange={e => setDateFrom(e.target.value)} 
            className="h-8 text-xs border-none focus-visible:ring-0 shadow-none w-32" 
          />
          <span className="text-muted-foreground text-xs">—</span>
          <Input 
            type="date" 
            value={dateTo} 
            onChange={e => setDateTo(e.target.value)} 
            className="h-8 text-xs border-none focus-visible:ring-0 shadow-none w-32" 
          />
        </div>
      </div>

      {/* Section 1: Asset Utilization */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Most Used Assets (90 Days)</h3>
            <Button 
              variant="outline" 
              size="icon-xs" 
              onClick={() => handleExportCSV("most_used_assets", utilization.mostUsed)}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-4 flex-1">
            <div className="h-64 w-full">
              {utilization.mostUsed.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilization.mostUsed} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 10)}...` : val} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 90]} />
                    <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.5)" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                    <Bar dataKey="utilizedDays" name="Days Used" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data available</div>
              )
}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Most Idle Assets (90 Days)</h3>
            <Button 
              variant="outline" 
              size="icon-xs" 
              onClick={() => handleExportCSV("idle_assets", utilization.idle)}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-4 flex-1">
            <div className="h-64 w-full">
              {utilization.idle.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={utilization.idle} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 10)}...` : val} angle={-25} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 90]} />
                    <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.5)" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                    <Bar dataKey="utilizedDays" name="Days Used" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data available</div>
              )
}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Maintenance Frequency */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Wrench className="h-4 w-4 text-primary" />
              Maintenance Frequency
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Based on selected date range.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-7"
            onClick={() => handleExportCSV("maintenance_frequency", maintenanceFreq.topAssets)}
          >
            <Download className="mr-1.5 h-3 w-3" />
            Export Assets
          </Button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="h-64">
            <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">By Category</h4>
            {maintenanceFreq.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenanceFreq.byCategory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <RechartsTooltip cursor={{ fill: "hsl(var(--muted)/0.5)" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                  <Bar dataKey="count" name="Issues" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No maintenance data</div>
            )}
          </div>
          
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider">Highest Maintenance Assets</h4>
            {maintenanceFreq.topAssets.length > 0 ? (
              <div className="overflow-hidden border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border">
                      <th className="text-left p-2 font-semibold">Asset</th>
                      <th className="text-left p-2 font-semibold">Category</th>
                      <th className="text-right p-2 font-semibold">Requests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {maintenanceFreq.topAssets.map(a => (
                      <tr key={a.id} className="hover:bg-muted/10">
                        <td className="p-2">
                          <span className="font-semibold block">{a.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{a.asset_tag}</span>
                        </td>
                        <td className="p-2 text-muted-foreground">{a.category}</td>
                        <td className="p-2 text-right font-bold text-destructive">{a.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                No high-maintenance assets found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 3 & 4: Retirement & Allocations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Retirement Heuristic */}
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Nearing Retirement
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[250px] leading-tight">
                Heuristic: Assets older than 4 years based on acquisition date.
              </p>
            </div>
            <Button 
              variant="outline" 
              size="icon-xs" 
              onClick={() => handleExportCSV("nearing_retirement", retirement.nearingRetirement)}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-0 overflow-y-auto max-h-72">
            {retirement.nearingRetirement.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-md">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold border-b border-border">Asset</th>
                    <th className="text-right px-4 py-2 font-semibold border-b border-border">Age (Years)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {retirement.nearingRetirement.map(a => (
                    <tr key={a.id} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5">
                        <span className="font-semibold block">{a.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{a.asset_tag}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-600">
                        {a.age_years.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No assets currently fit the retirement heuristic.
              </div>
            )}
          </div>
        </div>

        {/* Allocations Summary */}
        <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-blue-500" />
              Department Allocation Summary
            </h3>
            <Button 
              variant="outline" 
              size="icon-xs" 
              onClick={() => handleExportCSV("department_allocations", allocations)}
              title="Export CSV"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="p-0 overflow-y-auto max-h-72">
            {allocations.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-md">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold border-b border-border">Department</th>
                    <th className="text-right px-4 py-2 font-semibold border-b border-border">Allocated / Total</th>
                    <th className="text-right px-4 py-2 font-semibold border-b border-border">% Allocated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allocations.map(a => (
                    <tr key={a.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {a.name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold">{a.allocated_assets}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-muted-foreground">{a.total_assets}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge className={`${a.allocation_pct > 80 ? 'bg-green-500/10 text-green-600' : 'bg-primary/10 text-primary'} border-none font-bold py-0.5 px-2`}>
                          {a.allocation_pct}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No departmental data available.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Section 5: Booking Heatmap */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        <div className="border-b border-border p-4 bg-muted/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-purple-500" />
              Resource Booking Heatmap
            </h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Peak usage windows for bookable assets.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs h-7"
            onClick={() => handleExportCSV("booking_heatmap", heatmap)}
          >
            <Download className="mr-1.5 h-3 w-3" />
            Export Data
          </Button>
        </div>
        <div className="p-6 overflow-x-auto">
          {heatmap.length > 0 ? (
            <div className="min-w-[600px]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-[10px] font-semibold text-muted-foreground uppercase w-16">Hour</th>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                      <th key={day} className="p-2 text-center text-[10px] font-semibold text-muted-foreground uppercase">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((row, i) => (
                    <tr key={i}>
                      <td className="p-1.5 text-[10px] text-muted-foreground font-mono">{row.hour}</td>
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => {
                        const val = row[day];
                        // Compute color intensity based on val (max ~5 for a demo, adapt dynamically if needed)
                        const opacity = val === 0 ? 0 : Math.min(1, 0.2 + (val * 0.15));
                        
                        return (
                          <td key={day} className="p-1">
                            <div 
                              className="w-full h-8 rounded-md flex items-center justify-center text-[10px] font-bold transition-all hover:ring-2 ring-blue-500/30"
                              style={{ 
                                backgroundColor: val > 0 ? `rgba(59, 130, 246, ${opacity})` : 'hsl(var(--muted)/0.3)',
                                color: val > 0 ? (opacity > 0.6 ? 'white' : 'hsl(var(--foreground))') : 'transparent'
                              }}
                              title={`${val} bookings on ${day} at ${row.hour}`}
                            >
                              {val > 0 ? val : ""}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No booking data in this period.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
