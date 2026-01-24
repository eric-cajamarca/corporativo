// Script para probar el login de empresa
const axios = require('axios');

async function testLogin() {
  try {
    console.log('🧪 Probando login de empresa...\n');

    const loginData = {
      ruc: '20611688564',
      email: 'ventas@avefenix.com',
      password: '123456'
    };

    console.log('📤 Enviando datos:', loginData);

    const response = await axios.post('http://localhost:3000/api/admin_login', loginData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.data.data) {
      console.log('\n🎉 LOGIN EXITOSO!');
      console.log('Usuario:', response.data.data.nombres + ' ' + response.data.data.apellidos);
      console.log('Empresa:', response.data.data.razonSocial);
      console.log('Rol:', response.data.data.rol);
    } else {
      console.log('\n❌ Login falló:', response.data.message);
    }

  } catch (error) {
    console.error('\n❌ Error en la petición:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
      console.log('\n💡 Asegúrate de que el backend esté ejecutándose en http://localhost:3000');
    }
  }
}

// Ejecutar prueba
testLogin();