const allServices = [
  { name: 'gateway', url: 'http://localhost:4010/health' },
  { name: 'auth-service', url: 'http://localhost:4001/health' },
  { name: 'catalog-service', url: 'http://localhost:4002/health' },
  { name: 'collections-service', url: 'http://localhost:4013/health' },
  { name: 'marketplace-service', url: 'http://localhost:4014/health' },
  { name: 'trading-service', url: 'http://localhost:4015/health' },
  { name: 'notifications-service', url: 'http://localhost:4016/health' },
  { name: 'media-service', url: 'http://localhost:4017/health' },
  { name: 'realtime-service', url: 'http://localhost:4018/health' },
  { name: 'payments-service', url: 'http://localhost:4019/health' },
  { name: 'worker-service', url: 'http://localhost:4020/health' }
];

const args = process.argv.slice(2);
const strict = args.includes('--strict');

const onlyArg = args.find((arg) => arg.startsWith('--only='));
const onlyServices = onlyArg
  ? new Set(
      onlyArg
        .replace('--only=', '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  : null;

const services = onlyServices
  ? allServices.filter((service) => onlyServices.has(service.name))
  : allServices;

async function checkService(service) {
  try {
    const response = await fetch(service.url);

    if (!response.ok) {
      return {
        name: service.name,
        status: 'down',
        code: response.status
      };
    }

    const data = await response.json();

    return {
      name: service.name,
      status: 'up',
      data
    };
  } catch (error) {
    return {
      name: service.name,
      status: 'down',
      error: error.message
    };
  }
}

const results = await Promise.all(services.map(checkService));

const summary = {
  ok: results.every((service) => service.status === 'up'),
  checked: services.map((service) => service.name),
  services: results
};

console.log(JSON.stringify(summary, null, 2));

if (strict && !summary.ok) {
  process.exitCode = 1;
}