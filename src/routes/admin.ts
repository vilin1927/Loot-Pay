import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { exchangeRateAdminService } from '../services/admin/exchangeRateAdminService';
import { exchangeRateJobService } from '../services/jobs/exchangeRateJobService';

const router = express.Router();

/**
 * Admin Dashboard - Exchange Rate Overview
 * GET /admin/exchange-rates/dashboard
 * PRD Requirement: Rate monitoring and analytics
 */
router.get('/exchange-rates/dashboard', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin dashboard requested');
    
    const dashboardData = await exchangeRateAdminService.getDashboardData();
    
    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Admin dashboard error', { error });
    res.status(500).json({
      success: false,
      error: 'Dashboard data unavailable'
    });
  }
});

/**
 * Force Exchange Rate Update
 * POST /admin/exchange-rates/force-update
 * PRD Requirement: Manual rate update capability
 */
router.post('/exchange-rates/force-update', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin force update requested');
    
    const result = await exchangeRateAdminService.forceRateUpdate();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          new_rate: result.new_rate,
          source: result.source
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Admin force update error', { error });
    res.status(500).json({
      success: false,
      error: 'Force update failed'
    });
  }
});

/**
 * Set Manual Exchange Rate
 * POST /admin/exchange-rates/manual
 * Body: { rate: number, reason: string }
 * PRD Requirement: Manual rate override capability
 */
router.post('/exchange-rates/manual', async (req: Request, res: Response) => {
  try {
    const { rate, reason } = req.body;
    
    if (!rate || !reason) {
      res.status(400).json({
        success: false,
        error: 'Rate and reason are required'
      });
      return;
    }

    if (typeof rate !== 'number' || rate <= 0 || rate >= 1000) {
      res.status(400).json({
        success: false,
        error: 'Invalid rate value (must be between 0 and 1000)'
      });
      return;
    }

    logger.info('Admin manual rate set requested', { rate, reason });
    
    const result = await exchangeRateAdminService.setManualRate(rate, reason);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          rate: result.rate,
          expires_at: result.expires_at
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('Admin manual rate error', { error });
    res.status(500).json({
      success: false,
      error: 'Manual rate setting failed'
    });
  }
});

/**
 * Get Exchange Rate History
 * GET /admin/exchange-rates/history?limit=50
 * PRD Requirement: Rate change tracking and monitoring
 */
router.get('/exchange-rates/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (limit > 200) {
      res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 200'
      });
      return;
    }

    logger.info('Admin rate history requested', { limit });
    
    const history = await exchangeRateAdminService.getRecentRateHistory(limit);
    
    res.json({
      success: true,
      data: {
        history,
        count: history.length,
        limit
      }
    });

  } catch (error) {
    logger.error('Admin rate history error', { error });
    res.status(500).json({
      success: false,
      error: 'Rate history unavailable'
    });
  }
});

/**
 * Get Rate Change Alerts
 * GET /admin/exchange-rates/alerts
 * PRD Requirement: Rate monitoring and alerts
 */
router.get('/exchange-rates/alerts', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin rate alerts requested');
    
    const alerts = await exchangeRateAdminService.getRateAlerts();
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length
      }
    });

  } catch (error) {
    logger.error('Admin rate alerts error', { error });
    res.status(500).json({
      success: false,
      error: 'Rate alerts unavailable'
    });
  }
});

/**
 * Get Job Status and Statistics
 * GET /admin/exchange-rates/job-status
 * PRD Requirement: Job monitoring and health checks
 */
router.get('/exchange-rates/job-status', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin job status requested');
    
    const [basicStatus, detailedStats] = await Promise.all([
      exchangeRateJobService.getJobStatus(),
      exchangeRateJobService.getDetailedStatistics()
    ]);
    
    res.json({
      success: true,
      data: {
        basic_status: basicStatus,
        detailed_statistics: detailedStats
      }
    });

  } catch (error) {
    logger.error('Admin job status error', { error });
    res.status(500).json({
      success: false,
      error: 'Job status unavailable'
    });
  }
});

/**
 * Export Rate Data
 * GET /admin/exchange-rates/export?days=30
 * PRD Requirement: Data export for analysis
 */
router.get('/exchange-rates/export', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    if (days > 365) {
      res.status(400).json({
        success: false,
        error: 'Export period cannot exceed 365 days'
      });
      return;
    }

    logger.info('Admin rate data export requested', { days });
    
    const exportData = await exchangeRateAdminService.exportRateData(days);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="exchange_rates_${days}days_${new Date().toISOString().split('T')[0]}.json"`);
    
    res.json(exportData);

  } catch (error) {
    logger.error('Admin rate export error', { error });
    res.status(500).json({
      success: false,
      error: 'Rate data export failed'
    });
  }
});

/**
 * System Health Check
 * GET /admin/health
 * PRD Requirement: System monitoring
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin health check requested');
    
    const dashboardData = await exchangeRateAdminService.getDashboardData();
    const systemHealth = dashboardData.system_health;
    
    const statusCode = systemHealth.overall === 'critical' ? 503 : 
                      systemHealth.overall === 'warning' ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      status: systemHealth.overall,
      data: systemHealth
    });

  } catch (error) {
    logger.error('Admin health check error', { error });
    res.status(503).json({
      success: false,
      status: 'critical',
      error: 'Health check failed'
    });
  }
});

/**
 * Restart Exchange Rate Job
 * POST /admin/exchange-rates/restart-job
 * PRD Requirement: Job management
 */
router.post('/exchange-rates/restart-job', async (_req: Request, res: Response) => {
  try {
    logger.info('Admin job restart requested');
    
    // Stop and restart the job
    exchangeRateJobService.stopJob();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    exchangeRateJobService.startJob();
    
    const newStatus = exchangeRateJobService.getJobStatus();
    
    res.json({
      success: true,
      message: 'Exchange rate job restarted successfully',
      data: newStatus
    });

  } catch (error) {
    logger.error('Admin job restart error', { error });
    res.status(500).json({
      success: false,
      error: 'Job restart failed'
    });
  }
});

export default router; 