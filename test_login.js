// Script para probar el login (empresa o colaborador)
async function testLogin() {
  try {
    console.error('🧪 Probando login...\n');

    const loginData = {
      ruc: '20614636930',
      email: 'valentidiaz@gmail.com',
      password: '123456789'
    };

    console.error('📤 Enviando datos:', { ...loginData, password: '***' });

    const response = await fetch('http://localhost:3000/api/admin_login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    const data = await response.json();

    console.error('✅ Respuesta del servidor:');
    console.error('Status:', response.status);
    console.error('Data:', JSON.stringify(data, null, 2));

    if (data.data) {
      console.error('\n🎉 LOGIN EXITOSO!');
      console.error('Usuario:', data.data.nombres + ' ' + data.data.apellidos);
      console.error('Empresa:', data.data.razonSocial);
      console.error('Rol:', data.data.rol);
    } else {
      console.error('\n❌ Login falló:', data.message);
    }
  } catch (error) {
    console.error('\n❌ Error en la petición:', error.message);
    console.error('\n💡 Asegúrate de que el backend esté en http://localhost:3000');
  }
}

testLogin();