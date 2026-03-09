-- ============================================================
-- Fase 3: Comunicación de baja (RA)
-- - MotivoBaja: catálogo global (motivos de baja SUNAT)
-- - ComunicacionesBaja: cabecera de cada envío RA (ticket, estado)
-- - ComunicacionBajaDetalle: comprobantes incluidos en cada comunicación
-- ============================================================

-- Catálogo global de motivos de baja (no por empresa; descripción se envía en VoidedReasonDescription)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MotivoBaja')
BEGIN
  CREATE TABLE MotivoBaja (
    idMotivoBaja UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    codigoSunat VARCHAR(2) NOT NULL,
    descripcion VARCHAR(250) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_MotivoBaja_codigoSunat UNIQUE (codigoSunat)
  );
  CREATE INDEX IX_MotivoBaja_activo ON MotivoBaja(activo);

  -- Valores típicos según uso SUNAT (texto libre en VoidedReasonDescription)
  INSERT INTO MotivoBaja (codigoSunat, descripcion, activo) VALUES
  ('01', 'Anulación de la operación', 1),
  ('02', 'Anulación por error en el RUC', 1),
  ('03', 'Corrección por error en la descripción', 1),
  ('04', 'Error en el sistema', 1),
  ('05', 'Otros conceptos', 1);
END
GO

-- Cabecera de comunicaciones de baja enviadas (RA)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ComunicacionesBaja')
BEGIN
  CREATE TABLE ComunicacionesBaja (
    idComunicacionBaja UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idEmpresa UNIQUEIDENTIFIER NOT NULL,
    fechaComunicacion DATE NOT NULL,
    numeroCorrelativo VARCHAR(5) NOT NULL,
    ticketSunat VARCHAR(50) NULL,
    idEstadoSunat INT NULL,
    fechaEnvio VARCHAR(23) NULL,
    fechaRespuesta VARCHAR(23) NULL,
    codigoRespuesta VARCHAR(10) NULL,
    descripcionRespuesta VARCHAR(500) NULL,
    cdr NVARCHAR(MAX) NULL,
    fechaCreacion DATETIME2 NOT NULL DEFAULT GETDATE(),
    fechaModificacion DATETIME2 NULL,
    CONSTRAINT FK_ComunicacionesBaja_Empresa FOREIGN KEY (idEmpresa) REFERENCES Empresas(idEmpresa) ON DELETE CASCADE,
    CONSTRAINT FK_ComunicacionesBaja_Estado FOREIGN KEY (idEstadoSunat) REFERENCES EstadosSunat(idEstadoSunat)
  );
  CREATE INDEX IX_ComunicacionesBaja_EmpresaFecha ON ComunicacionesBaja(idEmpresa, fechaComunicacion);
  CREATE UNIQUE INDEX UQ_ComunicacionesBaja_EmpresaFechaCorrel ON ComunicacionesBaja(idEmpresa, fechaComunicacion, numeroCorrelativo);
END
GO

-- Detalle: comprobantes incluidos en cada comunicación de baja
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ComunicacionBajaDetalle')
BEGIN
  CREATE TABLE ComunicacionBajaDetalle (
    idComunicacionBajaDetalle UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    idComunicacionBaja UNIQUEIDENTIFIER NOT NULL,
    idComprobanteElectronico UNIQUEIDENTIFIER NOT NULL,
    motivoBaja VARCHAR(250) NOT NULL,
    CONSTRAINT FK_ComunicacionBajaDetalle_Comunicacion FOREIGN KEY (idComunicacionBaja) REFERENCES ComunicacionesBaja(idComunicacionBaja) ON DELETE CASCADE,
    CONSTRAINT FK_ComunicacionBajaDetalle_Comprobante FOREIGN KEY (idComprobanteElectronico) REFERENCES ComprobantesElectronicos(idComprobanteElectronico)
  );
  CREATE INDEX IX_ComunicacionBajaDetalle_Comunicacion ON ComunicacionBajaDetalle(idComunicacionBaja);
END
GO
