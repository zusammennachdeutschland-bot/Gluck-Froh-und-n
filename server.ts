import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/hod/dashboard/kpis", (req, res) => {
    res.json({
      visitsCount: 14,
      activePlansCount: 5,
      pendingComplaintsCount: 2,
      totalStudents: 600,
      weeklyPlanStatuses: [
        { gradeBand: "PRIMARY", status: "sent", secretaryName: "مريم علي" },
        { gradeBand: "PREPARATORY", status: "not_sent", secretaryName: "فاطمة حسن" },
        { gradeBand: "SECONDARY", status: "sent", secretaryName: "زينب أحمد" }
      ],
      lastUpdated: new Date().toISOString()
    });
  });

  app.get("/api/hod/dashboard/student-counts", (req, res) => {
    // Real-time calculation reflecting German department student demography across all stages and grades including G1-G3 primary
    const stages = [
      {
        id: "primary",
        nameAr: "المرحلة الابتدائية (Primarstufe)",
        nameEn: "Primary Stage",
        grades: [
          { grade: "G1", nameAr: "الصف الأول", count: 75 },
          { grade: "G2", nameAr: "الصف الثاني", count: 75 },
          { grade: "G3", nameAr: "الصف الثالث", count: 80 },
          { grade: "G4", nameAr: "الصف الرابع", count: 85 },
          { grade: "G5", nameAr: "الصف الخامس", count: 85 },
          { grade: "G6", nameAr: "الصف السادس", count: 80 }
        ]
      },
      {
        id: "preparatory",
        nameAr: "المرحلة الإعدادية (Sekundarstufe I)",
        nameEn: "Preparatory Stage",
        grades: [
          { grade: "G7", nameAr: "الصف الأول الإعدادي", count: 70 },
          { grade: "G8", nameAr: "الصف الثاني الإعدادي", count: 70 },
          { grade: "G9", nameAr: "الصف الثالث الإعدادي", count: 60 }
        ]
      },
      {
        id: "secondary",
        nameAr: "المرحلة الثانوية (Sekundarstufe II)",
        nameEn: "Secondary Stage",
        grades: [
          { grade: "G10", nameAr: "الصف الأول الثانوي", count: 45 },
          { grade: "G11", nameAr: "الصف الثاني الثانوي", count: 40 },
          { grade: "G12", nameAr: "الصف الثالث الثانوي", count: 35 }
        ]
      }
    ].map(stage => {
      const stageTotal = stage.grades.reduce((sum, g) => sum + g.count, 0);
      return { ...stage, total: stageTotal };
    });

    const grandTotal = stages.reduce((sum, s) => sum + s.total, 0);

    res.json({
      totalStudents: grandTotal,
      stages,
      lastUpdated: new Date().toISOString()
    });
  });

  app.get("/api/hod/dashboard/timetable", (req, res) => {
    res.json({
      dayKey: new Date().getDay().toString(),
      periodsCount: 8,
      teachers: [
        { id: 't-1', name: 'أ. أحمد علي', periods: { '1': '1A', '2': '2B', '3': '3C' } },
        { id: 't-2', name: 'أ. سارة محمود', periods: { '2': '4A', '4': '5B', '5': '6C' } },
        { id: 't-3', name: 'أ. عمر فاروق', periods: { '1': '7A', '3': '8B', '6': '9C' } }
      ],
      lastUpdated: new Date().toISOString()
    });
  });

  app.post("/api/hod/dashboard/action", (req, res) => {
    const { actionType, payload } = req.body;
    res.json({ success: true, actionType, id: Date.now().toString(), payload, timestamp: Date.now() });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
