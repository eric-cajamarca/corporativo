// Script para probar el login (empresa o colaborador)
async function testLogin() {
  try {
    console.log('🧪 Probando login...\n');

    const loginData = {
      ruc: '20614636930',
      email: 'valentidiaz@gmail.com',
      password: '123456789'
    };

    console.log('📤 Enviando datos:', { ...loginData, password: '***' });

    const response = await fetch('http://localhost:3000/api/admin_login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    const data = await response.json();

    console.log('✅ Respuesta del servidor:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));

    if (data.data) {
      console.log('\n🎉 LOGIN EXITOSO!');
      console.log('Usuario:', data.data.nombres + ' ' + data.data.apellidos);
      console.log('Empresa:', data.data.razonSocial);
      console.log('Rol:', data.data.rol);
    } else {
      console.log('\n❌ Login falló:', data.message);
    }
  } catch (error) {
    console.error('\n❌ Error en la petición:', error.message);
    console.log('\n💡 Asegúrate de que el backend esté en http://localhost:3000');
  }
}

testLogin();