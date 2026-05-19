const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Drop tables if exist
    await client.query(`
      DROP TABLE IF EXISTS ai_results CASCADE;
      DROP TABLE IF EXISTS maintenance_forecasts CASCADE;
      DROP TABLE IF EXISTS maintenance_logs CASCADE;
      DROP TABLE IF EXISTS print_profiles CASCADE;
      DROP TABLE IF EXISTS printers CASCADE;
      DROP TABLE IF EXISTS materials CASCADE;
      DROP TABLE IF EXISTS print_jobs CASCADE;
      DROP TABLE IF EXISTS quality_scores CASCADE;
      DROP TABLE IF EXISTS build_time_estimates CASCADE;
      DROP TABLE IF EXISTS material_selections CASCADE;
      DROP TABLE IF EXISTS failure_predictions CASCADE;
      DROP TABLE IF EXISTS print_parameters CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE print_parameters (
        id SERIAL PRIMARY KEY,
        material_type VARCHAR(100) NOT NULL,
        geometry_type VARCHAR(100) NOT NULL,
        layer_height DECIMAL(4,2),
        nozzle_temp INTEGER,
        bed_temp INTEGER,
        print_speed INTEGER,
        infill_density INTEGER,
        support_enabled BOOLEAN DEFAULT false,
        ai_result JSONB,
        ai_model_used VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE ai_results (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        input_data JSONB NOT NULL,
        raw_response TEXT,
        parsed_result JSONB,
        model_used VARCHAR(255),
        tokens_used INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE maintenance_forecasts (
        id SERIAL PRIMARY KEY,
        printer_name VARCHAR(255) NOT NULL,
        printer_id INTEGER,
        forecast_result JSONB,
        ai_model_used VARCHAR(255),
        next_maintenance_predicted DATE,
        estimated_cost DECIMAL(8,2),
        urgency VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE failure_predictions (
        id SERIAL PRIMARY KEY,
        print_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(100) NOT NULL,
        layer_height DECIMAL(4,2),
        nozzle_temp INTEGER,
        bed_temp INTEGER,
        print_speed INTEGER,
        geometry_complexity VARCHAR(50),
        risk_level VARCHAR(50),
        failure_type VARCHAR(255),
        notes TEXT,
        prediction_result JSONB,
        ai_model_used VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE material_selections (
        id SERIAL PRIMARY KEY,
        project_name VARCHAR(255) NOT NULL,
        application VARCHAR(255),
        strength_required INTEGER,
        flexibility_required INTEGER,
        heat_resistance VARCHAR(50),
        chemical_resistance VARCHAR(50),
        recommended_material VARCHAR(100),
        budget_level VARCHAR(50),
        notes TEXT,
        ai_result JSONB,
        ai_model_used VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE build_time_estimates (
        id SERIAL PRIMARY KEY,
        model_name VARCHAR(255) NOT NULL,
        dimensions_x DECIMAL(8,2),
        dimensions_y DECIMAL(8,2),
        dimensions_z DECIMAL(8,2),
        layer_height DECIMAL(4,2),
        infill_density INTEGER,
        print_speed INTEGER,
        material_type VARCHAR(100),
        estimated_hours DECIMAL(8,2),
        complexity VARCHAR(50),
        ai_result JSONB,
        ai_model_used VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE quality_scores (
        id SERIAL PRIMARY KEY,
        print_name VARCHAR(255) NOT NULL,
        surface_quality INTEGER,
        dimensional_accuracy INTEGER,
        layer_adhesion INTEGER,
        detail_resolution INTEGER,
        warping_level INTEGER,
        stringing_level INTEGER,
        overall_score DECIMAL(4,2),
        material_type VARCHAR(100),
        notes TEXT,
        ai_result JSONB,
        ai_model_used VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE print_jobs (
        id SERIAL PRIMARY KEY,
        job_name VARCHAR(255) NOT NULL,
        printer_name VARCHAR(255),
        material_type VARCHAR(100),
        status VARCHAR(50) DEFAULT 'queued',
        priority VARCHAR(50) DEFAULT 'Normal',
        estimated_time DECIMAL(8,2),
        material_weight_used_g DECIMAL(8,2),
        file_name VARCHAR(255),
        notes TEXT,
        ai_analysis JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE materials (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100),
        brand VARCHAR(100),
        color VARCHAR(50),
        diameter DECIMAL(4,2),
        weight_grams INTEGER,
        price DECIMAL(8,2),
        nozzle_temp_min INTEGER,
        nozzle_temp_max INTEGER,
        bed_temp_min INTEGER,
        bed_temp_max INTEGER,
        in_stock BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE printers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        model VARCHAR(255),
        manufacturer VARCHAR(255),
        build_volume_x INTEGER,
        build_volume_y INTEGER,
        build_volume_z INTEGER,
        nozzle_diameter DECIMAL(4,2),
        max_temp INTEGER,
        heated_bed BOOLEAN DEFAULT true,
        status VARCHAR(50) DEFAULT 'Idle',
        total_print_hours DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE print_profiles (
        id SERIAL PRIMARY KEY,
        profile_name VARCHAR(255) NOT NULL,
        material_type VARCHAR(100),
        layer_height DECIMAL(4,2),
        nozzle_temp INTEGER,
        bed_temp INTEGER,
        print_speed INTEGER,
        infill_density INTEGER,
        retraction_enabled BOOLEAN DEFAULT true,
        retraction_distance DECIMAL(4,2),
        fan_speed INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE maintenance_logs (
        id SERIAL PRIMARY KEY,
        printer_name VARCHAR(255) NOT NULL,
        maintenance_type VARCHAR(100),
        description TEXT,
        performed_by VARCHAR(255),
        cost DECIMAL(8,2),
        next_maintenance_date DATE,
        status VARCHAR(50) DEFAULT 'Completed',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Seed users
    const hashedPassword = await bcrypt.hash(process.env.DEFAULT_PASSWORD || 'admin123', 10);
    await client.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)`,
      ['Admin User', process.env.DEFAULT_EMAIL || 'admin@3dprint.com', hashedPassword]
    );

    // Seed print_parameters (15 items)
    const printParams = [
      ['PLA', 'Cube', 0.2, 200, 60, 50, 20, false],
      ['ABS', 'Cylinder', 0.15, 240, 100, 40, 25, false],
      ['PETG', 'Sphere', 0.2, 235, 80, 45, 30, true],
      ['TPU', 'Flat Panel', 0.3, 220, 50, 25, 15, false],
      ['Nylon', 'Complex Organic', 0.1, 260, 80, 35, 40, true],
      ['PLA', 'Gear Mechanism', 0.12, 205, 60, 40, 50, false],
      ['ABS', 'Enclosure Box', 0.2, 245, 110, 50, 20, false],
      ['PETG', 'Threaded Part', 0.15, 230, 75, 35, 30, false],
      ['PLA+', 'Miniature Figure', 0.08, 210, 60, 30, 25, true],
      ['ASA', 'Outdoor Mount', 0.2, 250, 100, 45, 35, true],
      ['Carbon Fiber PLA', 'Drone Frame', 0.15, 215, 60, 40, 45, false],
      ['Wood PLA', 'Decorative Vase', 0.3, 195, 55, 35, 10, false],
      ['PETG', 'Phone Case', 0.2, 235, 80, 50, 25, false],
      ['TPU', 'Gasket Seal', 0.15, 225, 50, 20, 100, false],
      ['PLA', 'Architectural Model', 0.1, 200, 60, 45, 15, true]
    ];
    for (const p of printParams) {
      await client.query(
        `INSERT INTO print_parameters (material_type, geometry_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, support_enabled) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        p
      );
    }

    // Seed failure_predictions (15 items)
    const failures = [
      ['Benchy Boat', 'PLA', 0.2, 200, 60, 50, 'Medium', 'Low', 'None', 'Standard test print'],
      ['Large Vase', 'PETG', 0.3, 240, 85, 60, 'Low', 'Medium', 'Warping', 'Tall thin-walled print'],
      ['Engine Block', 'ABS', 0.15, 245, 110, 40, 'High', 'High', 'Layer Delamination', 'Complex internal channels'],
      ['Flexible Phone Case', 'TPU', 0.2, 225, 50, 20, 'Low', 'Medium', 'Stringing', 'First TPU print attempt'],
      ['Nylon Gear Set', 'Nylon', 0.1, 260, 80, 30, 'High', 'High', 'Warping', 'Moisture sensitive material'],
      ['Bridge Test', 'PLA', 0.2, 200, 60, 50, 'Medium', 'Medium', 'Sagging', 'Long bridge spans'],
      ['Articulated Dragon', 'PLA', 0.15, 205, 60, 35, 'High', 'Medium', 'Supports Fail', 'Print-in-place joints'],
      ['Outdoor Bracket', 'ASA', 0.2, 250, 105, 45, 'Medium', 'Low', 'None', 'UV resistant needed'],
      ['Lithophane', 'PLA', 0.12, 195, 60, 30, 'Medium', 'Medium', 'Layer Lines', 'Need smooth finish'],
      ['Helmet Visor', 'PETG', 0.2, 235, 80, 40, 'High', 'High', 'Elephant Foot', 'Large flat base'],
      ['Drone Prop Guard', 'Carbon Fiber PLA', 0.15, 215, 60, 45, 'Medium', 'Low', 'Nozzle Wear', 'Abrasive filament'],
      ['Cookie Cutter', 'PLA', 0.3, 200, 60, 60, 'Low', 'Low', 'None', 'Simple geometry'],
      ['Turbine Blade', 'Nylon', 0.08, 265, 85, 25, 'High', 'Critical', 'Warping', 'Very thin geometry'],
      ['Cable Management', 'TPU', 0.25, 220, 45, 20, 'Low', 'Low', 'Stringing', 'Flexible clips'],
      ['Chess Set', 'PLA+', 0.1, 210, 60, 35, 'Medium', 'Medium', 'Detail Loss', 'Fine details needed']
    ];
    for (const f of failures) {
      await client.query(
        `INSERT INTO failure_predictions (print_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, geometry_complexity, risk_level, failure_type, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        f
      );
    }

    // Seed material_selections (15 items)
    const matSelections = [
      ['Robot Arm', 'Functional Prototype', 8, 3, 'Medium', 'Low', 'PLA+', 'Low', 'Need strong but affordable'],
      ['Outdoor Planter', 'Garden Equipment', 5, 2, 'High', 'Medium', 'ASA', 'Medium', 'UV and weather resistant'],
      ['Medical Device Housing', 'Medical', 9, 4, 'High', 'High', 'PETG', 'High', 'Sterilization compatible'],
      ['Shoe Insole', 'Wearable', 3, 9, 'Low', 'Low', 'TPU', 'Medium', 'Comfort and flexibility'],
      ['Automotive Clip', 'Automotive', 8, 2, 'High', 'High', 'Nylon', 'Medium', 'Under-hood application'],
      ['Display Stand', 'Retail Display', 4, 2, 'Low', 'Low', 'PLA', 'Low', 'Aesthetic focus'],
      ['Drone Body', 'Aerospace', 9, 3, 'Medium', 'Low', 'Carbon Fiber PLA', 'Medium', 'Lightweight and strong'],
      ['Food Container Lid', 'Food Safe', 6, 3, 'Medium', 'High', 'PETG', 'Low', 'Must be food safe'],
      ['Wrist Brace', 'Orthopedic', 7, 7, 'Low', 'Low', 'TPU', 'Medium', 'Custom fit needed'],
      ['Cable Organizer', 'Office Supply', 3, 5, 'Low', 'Low', 'PLA', 'Low', 'Simple desk accessory'],
      ['Waterproof Housing', 'Electronics', 7, 2, 'Medium', 'High', 'PETG', 'Medium', 'IP67 rating desired'],
      ['Prosthetic Socket', 'Medical', 8, 6, 'Medium', 'Medium', 'Nylon', 'High', 'Biocompatible needed'],
      ['RC Car Chassis', 'Hobby', 9, 3, 'Low', 'Low', 'ABS', 'Low', 'Impact resistant'],
      ['Lamp Shade', 'Home Decor', 2, 4, 'Medium', 'Low', 'PLA', 'Low', 'Translucent preferred'],
      ['Pipe Fitting', 'Plumbing', 7, 2, 'High', 'High', 'PETG', 'Medium', 'Pressure rated']
    ];
    for (const m of matSelections) {
      await client.query(
        `INSERT INTO material_selections (project_name, application, strength_required, flexibility_required, heat_resistance, chemical_resistance, recommended_material, budget_level, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        m
      );
    }

    // Seed build_time_estimates (15 items)
    const buildTimes = [
      ['Benchy', 60, 31, 48, 0.2, 20, 50, 'PLA', 1.5, 'Medium'],
      ['Phone Stand', 80, 60, 100, 0.2, 25, 45, 'PETG', 3.2, 'Low'],
      ['Vase Mode Spiral', 150, 150, 200, 0.3, 0, 40, 'PLA', 4.0, 'Low'],
      ['Articulated Octopus', 100, 100, 60, 0.15, 15, 35, 'PLA', 5.5, 'High'],
      ['Helmet Full Size', 220, 250, 280, 0.2, 15, 50, 'PETG', 28.0, 'High'],
      ['Raspberry Pi Case', 90, 60, 30, 0.2, 20, 50, 'PLA', 2.0, 'Low'],
      ['Gear Train Assembly', 80, 80, 40, 0.1, 50, 30, 'Nylon', 8.5, 'High'],
      ['Desk Organizer', 200, 150, 80, 0.25, 15, 55, 'PLA', 6.0, 'Medium'],
      ['Drone Frame', 250, 250, 30, 0.15, 40, 40, 'Carbon Fiber PLA', 4.5, 'Medium'],
      ['Chess Piece King', 30, 30, 80, 0.08, 20, 30, 'PLA', 3.0, 'High'],
      ['Wall Mount Bracket', 100, 50, 20, 0.3, 30, 60, 'PETG', 1.0, 'Low'],
      ['Lithophane Panel', 150, 1, 100, 0.12, 100, 25, 'PLA', 5.0, 'Medium'],
      ['Mechanical Keyboard Case', 350, 130, 25, 0.2, 20, 45, 'ABS', 7.5, 'Medium'],
      ['Plant Pot', 120, 120, 150, 0.3, 10, 50, 'PLA', 3.5, 'Low'],
      ['Headphone Stand', 100, 80, 200, 0.2, 20, 45, 'PETG', 9.0, 'Medium']
    ];
    for (const b of buildTimes) {
      await client.query(
        `INSERT INTO build_time_estimates (model_name, dimensions_x, dimensions_y, dimensions_z, layer_height, infill_density, print_speed, material_type, estimated_hours, complexity) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        b
      );
    }

    // Seed quality_scores (15 items)
    const qualityScores = [
      ['Benchy Test Print', 8, 9, 9, 7, 9, 8, 8.3, 'PLA', 'Standard calibration print'],
      ['Phone Case v2', 7, 8, 8, 7, 8, 6, 7.3, 'TPU', 'Slight stringing on edges'],
      ['Gear Assembly', 9, 9, 9, 8, 9, 9, 8.8, 'Nylon', 'Excellent dimensional accuracy'],
      ['Large Enclosure', 6, 7, 7, 6, 5, 7, 6.3, 'ABS', 'Some warping on corners'],
      ['Miniature Figure', 9, 8, 8, 9, 9, 7, 8.3, 'PLA', 'Great detail at 0.08mm'],
      ['Vase Spiral', 8, 7, 8, 7, 8, 9, 7.8, 'PLA', 'Smooth vase mode finish'],
      ['Drone Mount', 7, 9, 8, 6, 8, 7, 7.5, 'Carbon Fiber PLA', 'Strong but rough surface'],
      ['Cookie Cutter Set', 7, 8, 7, 6, 9, 8, 7.5, 'PLA', 'Good for food contact'],
      ['Headphone Hook', 8, 8, 8, 8, 9, 8, 8.2, 'PETG', 'Clean print overall'],
      ['Articulated Snake', 7, 6, 7, 8, 8, 5, 6.8, 'PLA', 'Some joints too tight'],
      ['Cable Clip Set', 8, 7, 8, 7, 9, 8, 7.8, 'PLA', 'Batch of 20 clips'],
      ['Outdoor Bracket', 6, 8, 7, 5, 6, 7, 6.5, 'ASA', 'Layer adhesion concern'],
      ['Watch Stand', 9, 9, 9, 9, 9, 9, 9.0, 'PLA+', 'Perfect print result'],
      ['Prosthetic Socket', 7, 9, 8, 7, 7, 7, 7.5, 'Nylon', 'Functional prototype'],
      ['Lamp Shade', 8, 7, 8, 8, 8, 8, 7.8, 'PLA', 'Good light diffusion']
    ];
    for (const q of qualityScores) {
      await client.query(
        `INSERT INTO quality_scores (print_name, surface_quality, dimensional_accuracy, layer_adhesion, detail_resolution, warping_level, stringing_level, overall_score, material_type, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        q
      );
    }

    // Seed print_jobs (15 items)
    const printJobs = [
      ['Benchy Calibration', 'Printer-01', 'PLA', 'Completed', 'Normal', 1.5, 'benchy.gcode', 'Initial calibration'],
      ['Phone Case Order', 'Printer-02', 'TPU', 'Printing', 'High', 3.0, 'phone_case_v3.gcode', 'Client order #1234'],
      ['Gear Set Prototype', 'Printer-01', 'Nylon', 'Queued', 'High', 8.0, 'gear_assembly.gcode', 'Engineering dept request'],
      ['Plant Pot Batch', 'Printer-03', 'PLA', 'Queued', 'Low', 12.0, 'plant_pot_x5.gcode', '5 pots for office'],
      ['Drone Frame v2', 'Printer-02', 'Carbon Fiber PLA', 'Completed', 'Normal', 4.5, 'drone_frame.gcode', 'Iteration 2'],
      ['Custom Badge', 'Printer-01', 'PLA', 'Failed', 'Low', 0.5, 'badge.gcode', 'Bed adhesion failure'],
      ['Helmet Part A', 'Printer-03', 'PETG', 'Printing', 'Normal', 14.0, 'helmet_top.gcode', 'Part 1 of 3'],
      ['Cable Management Kit', 'Printer-01', 'PLA', 'Completed', 'Low', 2.0, 'cable_clips.gcode', 'Desk organization'],
      ['Raspberry Pi Enclosure', 'Printer-02', 'PETG', 'Queued', 'Normal', 2.5, 'rpi_case.gcode', 'Server rack mount'],
      ['Prototype Housing', 'Printer-03', 'ABS', 'Printing', 'High', 6.0, 'housing_v4.gcode', 'Electronics enclosure'],
      ['Trophy Base', 'Printer-01', 'PLA+', 'Queued', 'Normal', 3.5, 'trophy_base.gcode', 'Company event'],
      ['Gasket Set', 'Printer-02', 'TPU', 'Completed', 'High', 1.5, 'gaskets.gcode', 'Maintenance parts'],
      ['Wall Art Panel', 'Printer-03', 'PLA', 'Queued', 'Low', 8.0, 'wall_art.gcode', 'Reception decoration'],
      ['Keyboard Keycap', 'Printer-01', 'ABS', 'Completed', 'Normal', 0.5, 'keycap_set.gcode', 'Custom key design'],
      ['Water Fitting', 'Printer-02', 'PETG', 'Queued', 'High', 1.0, 'pipe_fitting.gcode', 'Plumbing repair']
    ];
    for (const j of printJobs) {
      await client.query(
        `INSERT INTO print_jobs (job_name, printer_name, material_type, status, priority, estimated_time, file_name, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        j
      );
    }

    // Seed materials (15 items)
    const materialsData = [
      ['PLA Standard White', 'PLA', 'Hatchbox', 'White', 1.75, 1000, 24.99, 190, 220, 50, 70, true],
      ['PLA Standard Black', 'PLA', 'Hatchbox', 'Black', 1.75, 1000, 24.99, 190, 220, 50, 70, true],
      ['ABS Grey', 'ABS', 'eSUN', 'Grey', 1.75, 1000, 22.99, 230, 260, 95, 115, true],
      ['PETG Transparent', 'PETG', 'Overture', 'Clear', 1.75, 1000, 21.99, 220, 250, 70, 90, true],
      ['TPU 95A Black', 'TPU', 'NinjaTek', 'Black', 1.75, 750, 45.99, 210, 230, 40, 60, true],
      ['Nylon PA12', 'Nylon', 'Polymaker', 'Natural', 1.75, 750, 39.99, 250, 270, 70, 90, false],
      ['PLA+ Red', 'PLA+', 'eSUN', 'Red', 1.75, 1000, 27.99, 200, 220, 55, 70, true],
      ['ASA Orange', 'ASA', 'Prusament', 'Orange', 1.75, 850, 35.99, 240, 260, 95, 110, true],
      ['Carbon Fiber PLA', 'Carbon Fiber PLA', 'Protopasta', 'Dark Grey', 1.75, 500, 49.99, 200, 230, 50, 70, true],
      ['Wood PLA', 'Wood PLA', 'Hatchbox', 'Wood', 1.75, 1000, 29.99, 185, 210, 50, 65, false],
      ['PETG Blue', 'PETG', 'Overture', 'Blue', 1.75, 1000, 21.99, 220, 250, 70, 90, true],
      ['PLA Silk Gold', 'PLA', 'TTYT3D', 'Gold', 1.75, 1000, 28.99, 195, 215, 55, 65, true],
      ['TPU 85A Clear', 'TPU', 'NinjaTek', 'Clear', 1.75, 500, 52.99, 215, 235, 40, 55, false],
      ['ABS White', 'ABS', 'Hatchbox', 'White', 1.75, 1000, 23.99, 230, 255, 95, 110, true],
      ['PLA Matte Green', 'PLA', 'Polymaker', 'Green', 1.75, 1000, 26.99, 195, 215, 55, 70, true]
    ];
    for (const m of materialsData) {
      await client.query(
        `INSERT INTO materials (name, type, brand, color, diameter, weight_grams, price, nozzle_temp_min, nozzle_temp_max, bed_temp_min, bed_temp_max, in_stock) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        m
      );
    }

    // Seed printers (15 items)
    const printersData = [
      ['Printer-01', 'Ender 3 V2', 'Creality', 220, 220, 250, 0.4, 260, true, 'Idle', 342.5, 'Main workhorse'],
      ['Printer-02', 'Prusa i3 MK3S+', 'Prusa Research', 250, 210, 210, 0.4, 300, true, 'Printing', 1205.0, 'High quality prints'],
      ['Printer-03', 'Ender 5 Plus', 'Creality', 350, 350, 400, 0.4, 260, true, 'Printing', 567.0, 'Large format'],
      ['Printer-04', 'Voron 2.4', 'Self-Built', 350, 350, 350, 0.4, 350, true, 'Idle', 890.0, 'CoreXY speed demon'],
      ['Printer-05', 'Bambu Lab X1C', 'Bambu Lab', 256, 256, 256, 0.4, 300, true, 'Idle', 234.0, 'Multi-material capable'],
      ['Printer-06', 'Ender 3 S1 Pro', 'Creality', 220, 220, 270, 0.4, 300, true, 'Maintenance', 456.0, 'Direct drive upgrade'],
      ['Printer-07', 'Prusa Mini+', 'Prusa Research', 180, 180, 180, 0.4, 280, true, 'Idle', 123.5, 'Small parts printer'],
      ['Printer-08', 'Anycubic Kobra 2', 'Anycubic', 220, 220, 250, 0.4, 260, true, 'Queued', 78.0, 'New addition'],
      ['Printer-09', 'Sovol SV06', 'Sovol', 220, 220, 250, 0.4, 300, true, 'Idle', 189.0, 'Budget all-metal'],
      ['Printer-10', 'Elegoo Neptune 3 Pro', 'Elegoo', 225, 225, 280, 0.4, 260, true, 'Printing', 345.0, 'Dual Z reliable'],
      ['Printer-11', 'Bambu Lab P1S', 'Bambu Lab', 256, 256, 256, 0.4, 300, true, 'Idle', 567.0, 'Enclosed chamber'],
      ['Printer-12', 'Artillery Sidewinder X2', 'Artillery', 300, 300, 400, 0.4, 260, true, 'Offline', 234.0, 'Needs repair'],
      ['Printer-13', 'Creality K1 Max', 'Creality', 300, 300, 300, 0.4, 300, true, 'Idle', 89.0, 'High speed'],
      ['Printer-14', 'FlashForge Adventurer 5M', 'FlashForge', 220, 220, 220, 0.4, 280, true, 'Queued', 145.0, 'Entry level enclosed'],
      ['Printer-15', 'RatRig V-Core 3', 'Self-Built', 300, 300, 300, 0.4, 350, true, 'Idle', 456.0, 'Custom CoreXY']
    ];
    for (const p of printersData) {
      await client.query(
        `INSERT INTO printers (name, model, manufacturer, build_volume_x, build_volume_y, build_volume_z, nozzle_diameter, max_temp, heated_bed, status, total_print_hours, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        p
      );
    }

    // Seed print_profiles (15 items)
    const profiles = [
      ['PLA Standard', 'PLA', 0.2, 200, 60, 50, 20, true, 5.0, 100, 'Default PLA profile'],
      ['PLA Fine Detail', 'PLA', 0.08, 195, 60, 30, 20, true, 4.0, 100, 'For miniatures and fine detail'],
      ['PLA Fast Draft', 'PLA', 0.3, 210, 60, 80, 10, true, 6.0, 100, 'Quick prototypes'],
      ['ABS Standard', 'ABS', 0.2, 245, 110, 45, 20, true, 5.0, 0, 'Enclosed printer recommended'],
      ['ABS Strong', 'ABS', 0.15, 250, 110, 35, 40, true, 4.5, 0, 'Maximum strength'],
      ['PETG Standard', 'PETG', 0.2, 235, 80, 45, 20, true, 5.5, 50, 'All-purpose PETG'],
      ['PETG Transparent', 'PETG', 0.15, 230, 80, 35, 15, true, 5.0, 40, 'Maximize clarity'],
      ['TPU Flexible', 'TPU', 0.2, 220, 50, 20, 15, false, 0.0, 100, 'Disable retraction for TPU'],
      ['Nylon Functional', 'Nylon', 0.15, 260, 80, 35, 40, true, 4.0, 50, 'Dry filament required'],
      ['ASA Outdoor', 'ASA', 0.2, 250, 100, 40, 25, true, 5.0, 30, 'UV resistant parts'],
      ['Carbon Fiber', 'Carbon Fiber PLA', 0.2, 215, 60, 40, 30, true, 5.0, 100, 'Hardened nozzle required'],
      ['PLA+ Structural', 'PLA+', 0.15, 210, 60, 40, 35, true, 5.0, 100, 'Enhanced PLA'],
      ['PETG Functional', 'PETG', 0.2, 240, 85, 40, 30, true, 5.0, 60, 'Mechanical parts'],
      ['Vase Mode', 'PLA', 0.3, 200, 60, 40, 0, false, 0.0, 100, 'Spiral vase mode'],
      ['Speed Profile', 'PLA', 0.25, 215, 65, 100, 15, true, 6.0, 100, 'High speed printers only']
    ];
    for (const p of profiles) {
      await client.query(
        `INSERT INTO print_profiles (profile_name, material_type, layer_height, nozzle_temp, bed_temp, print_speed, infill_density, retraction_enabled, retraction_distance, fan_speed, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        p
      );
    }

    // Seed maintenance_logs (15 items)
    const maintenanceLogs = [
      ['Printer-01', 'Nozzle Replacement', 'Replaced worn 0.4mm brass nozzle with hardened steel', 'John', 15.99, '2026-04-15', 'Completed', 'Was printing carbon fiber'],
      ['Printer-02', 'Belt Tension', 'Adjusted X and Y belts to proper tension', 'Sarah', 0.00, '2026-06-01', 'Completed', 'Regular maintenance'],
      ['Printer-03', 'Firmware Update', 'Updated to latest Marlin 2.1.2', 'Mike', 0.00, '2026-04-01', 'Completed', 'Added input shaping'],
      ['Printer-04', 'Full Service', 'Complete teardown, clean, lubricate, reassemble', 'John', 45.00, '2026-07-01', 'Completed', 'Annual maintenance'],
      ['Printer-05', 'Hotend Clean', 'Cleared partial clog in hotend', 'Sarah', 0.00, '2026-04-10', 'Completed', 'Was underextruding'],
      ['Printer-06', 'Bed Replacement', 'Replaced warped aluminum bed plate', 'Mike', 35.00, '2026-05-01', 'In Progress', 'Waiting for parts'],
      ['Printer-12', 'Mainboard Repair', 'Replacing failed stepper driver on mainboard', 'John', 65.00, '2026-04-20', 'In Progress', 'Printer currently offline'],
      ['Printer-07', 'PINDA Calibration', 'Recalibrated probe offset and mesh leveling', 'Sarah', 0.00, '2026-05-15', 'Completed', 'First layer was off'],
      ['Printer-08', 'Lubrication', 'Lubricated all linear rails and lead screws', 'Mike', 8.99, '2026-06-15', 'Scheduled', 'Preventive maintenance'],
      ['Printer-09', 'Extruder Upgrade', 'Upgraded to dual gear extruder', 'John', 29.99, '2026-04-05', 'Completed', 'Better TPU compatibility'],
      ['Printer-10', 'Z-Offset Calibration', 'Fine-tuned Z-offset after nozzle change', 'Sarah', 0.00, '2026-04-20', 'Completed', 'Routine adjustment'],
      ['Printer-11', 'Carbon Rod Check', 'Inspected carbon fiber rods for wear', 'Mike', 0.00, '2026-07-15', 'Scheduled', '6-month check'],
      ['Printer-13', 'Cooling Fan Replace', 'Replaced failing part cooling fan', 'John', 12.99, '2026-04-01', 'Completed', 'Fan was noisy'],
      ['Printer-14', 'Bowden Tube', 'Replaced PTFE tube showing signs of degradation', 'Sarah', 5.99, '2026-05-10', 'Completed', 'Capricorn tube upgrade'],
      ['Printer-15', 'Tensioner Upgrade', 'Installed auto-tensioners for all belts', 'Mike', 25.00, '2026-06-01', 'Scheduled', 'Quality of life mod']
    ];
    for (const l of maintenanceLogs) {
      await client.query(
        `INSERT INTO maintenance_logs (printer_name, maintenance_type, description, performed_by, cost, next_maintenance_date, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        l
      );
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
