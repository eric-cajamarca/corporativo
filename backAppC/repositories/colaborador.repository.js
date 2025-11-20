const sql = require('mssql');


exports.updateEstado = async (id, estado, idEmpresa) =>{
    try {
      const pool = await sql.connect(dbConfig);
      const result = await pool
        .request()
        .input('idUsuario', sql.UniqueIdentifier, id)
        .input('estado', sql.Bit, estado)
        .input('idEmpresa', sql.UniqueIdentifier, idEmpresa)
        .query('UPDATE usuarioWeb SET estado = @estado WHERE idUsuario = @idUsuario and idEmpresa = @idEmpresa');
      
      return result;
    } catch (error) {
      throw new Error(`Repository Error: ${error.message}`);
    }
  
}